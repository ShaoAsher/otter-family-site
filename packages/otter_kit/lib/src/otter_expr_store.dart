import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import 'family_config.dart';

/// 动图按需从家族 TOS `expr/<版本>/` 拉取，静帧仍走安装包内 [stillAssetPath]。
abstract final class OtterExprStore {
  static const _fallbackBase =
      'https://otter-family-site.tos-cn-beijing.volces.com/library/latest/expr/';

  static String _version = 'v3';
  static Map<String, String>? _manifestMd5;
  static final Map<String, Future<File?>> _inflight = {};

  /// App 启动时调用（`otter.json` → `expr.version`）。
  static void configure({required String version}) {
    _version = version;
    _manifestMd5 = null;
  }

  static String stillAssetPath(String key) =>
      'assets/otter/expr/still/270/$key.webp';

  static String get _remoteBase {
    final url = FamilyConfig.current.value?.exprAssetsBase ?? '';
    if (url.isNotEmpty) return url;
    return _fallbackBase;
  }

  static Future<Map<String, String>> _manifest() async {
    if (_manifestMd5 != null) return _manifestMd5!;
    final cache = await _cacheRoot();
    final manifestFile = File('${cache.path}/manifest.json');
    Map<String, dynamic> json;
    if (manifestFile.existsSync()) {
      try {
        json = jsonDecode(await manifestFile.readAsString()) as Map<String, dynamic>;
        final files = json['files'] as Map<String, dynamic>? ?? {};
        _manifestMd5 = {
          for (final e in files.entries)
            e.key: (e.value as Map)['md5'] as String? ?? '',
        };
        return _manifestMd5!;
      } catch (_) {}
    }
    final url = Uri.parse('${_remoteBase}manifest.json');
    final r = await http.get(url).timeout(const Duration(seconds: 20));
    if (r.statusCode != 200) {
      throw StateError('expr manifest ${r.statusCode}');
    }
    await manifestFile.parent.create(recursive: true);
    await manifestFile.writeAsBytes(r.bodyBytes);
    json = jsonDecode(utf8.decode(r.bodyBytes)) as Map<String, dynamic>;
    final files = json['files'] as Map<String, dynamic>? ?? {};
    _manifestMd5 = {
      for (final e in files.entries)
        e.key: (e.value as Map)['md5'] as String? ?? '',
    };
    return _manifestMd5!;
  }

  static Future<Directory> _cacheRoot() async {
    final dir = await getApplicationSupportDirectory();
    final root = Directory('${dir.path}/otter-expr/$_version');
    if (!root.existsSync()) root.createSync(recursive: true);
    return root;
  }

  /// 本地动图文件；失败返回 null（界面应回退静帧）。
  static Future<File?> animFile(String key) {
    return _inflight.putIfAbsent(key, () => _fetchAnim(key));
  }

  static Future<File?> _fetchAnim(String key) async {
    if (kIsWeb) return null;
    final name = 'anim/270/$key.webp';
    try {
      await _manifest();
      final root = await _cacheRoot();
      final dest = File('${root.path}/$name');
      if (dest.existsSync() && dest.lengthSync() > 512) return dest;
      final url = Uri.parse('$_remoteBase$name');
      final r = await http.get(url).timeout(const Duration(seconds: 45));
      if (r.statusCode != 200) return null;
      await dest.parent.create(recursive: true);
      final tmp = '${dest.path}.part';
      await File(tmp).writeAsBytes(r.bodyBytes);
      await File(tmp).rename(dest.path);
      return dest;
    } catch (_) {
      return null;
    } finally {
      _inflight.remove(key);
    }
  }
}