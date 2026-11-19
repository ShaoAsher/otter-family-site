import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import 'family_config.dart';

/// 动图按需从家族 TOS `library/latest/expr/anim/{270|540}/` 拉取，静帧走安装包 [stillAssetPath]。
///
/// 默认 **270**；用户在设置打开「高清动图」后走 **540**（[hdAnim]）。
abstract final class OtterExprStore {
  static const _fallbackBase =
      'https://otter-family-site.tos-cn-beijing.volces.com/library/latest/expr/';

  /// 本地缓存目录名（与远端路径无关；历史兼容保留 `v3`）。
  static String _version = 'v3';
  static Map<String, String>? _manifestMd5;

  /// 高清动图（540）。默认关 = 270。
  static final ValueNotifier<bool> hdAnim = ValueNotifier<bool>(false);

  /// 进行中 + 已成功的 Future：按 `size/key` 区分，避免 270/540 互相污染。
  static final Map<String, Future<File?>> _anim = {};

  /// App 启动时调用（`otter.json` → `expr.version`）。
  static void configure({required String version}) {
    _version = version;
    _manifestMd5 = null;
  }

  /// 从本机偏好恢复高清开关（各 App 启动时调一次）。
  static void setHdAnim(bool value, {bool clearCache = true}) {
    if (hdAnim.value == value) return;
    hdAnim.value = value;
    if (clearCache) {
      _anim.clear();
      _manifestMd5 = null;
    }
  }

  static int get animSize => hdAnim.value ? 540 : 270;

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
        json =
            jsonDecode(await manifestFile.readAsString()) as Map<String, dynamic>;
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
  ///
  /// 同一 `size/key` 始终返回同一个 [Future]（成功后也保留）。
  static Future<File?> animFile(String key) {
    final slot = '${animSize}/$key';
    return _anim.putIfAbsent(slot, () => _fetchAnim(key, animSize));
  }

  static Future<File?> _fetchAnim(String key, int size) async {
    if (kIsWeb) return null;
    final name = 'anim/$size/$key.webp';
    final slot = '$size/$key';
    try {
      await _manifest();
      final root = await _cacheRoot();
      final dest = File('${root.path}/$name');
      if (dest.existsSync() && dest.lengthSync() > 512) return dest;
      final url = Uri.parse('$_remoteBase$name');
      final r = await http.get(url).timeout(const Duration(seconds: 45));
      if (r.statusCode != 200) {
        debugPrint('[OtterExprStore] $name → HTTP ${r.statusCode}');
        // 高清失败回落 270；成功则保留本 slot 的 Future，避免反复重试 540
        if (size != 270) {
          final fallback = await animFileAt(key, 270);
          if (fallback == null) _anim.remove(slot);
          return fallback;
        }
        _anim.remove(slot);
        return null;
      }
      await dest.parent.create(recursive: true);
      final tmp = '${dest.path}.part';
      await File(tmp).writeAsBytes(r.bodyBytes);
      await File(tmp).rename(dest.path);
      debugPrint('[OtterExprStore] $name cached ${r.bodyBytes.length}B');
      return dest;
    } catch (e, st) {
      debugPrint('[OtterExprStore] $name failed: $e');
      assert(() {
        debugPrint('$st');
        return true;
      }());
      if (size != 270) {
        final fallback = await animFileAt(key, 270);
        if (fallback == null) _anim.remove(slot);
        return fallback;
      }
      _anim.remove(slot);
      return null;
    }
  }

  /// 指定档位拉取（高清失败回落用）。
  static Future<File?> animFileAt(String key, int size) {
    final slot = '$size/$key';
    return _anim.putIfAbsent(slot, () => _fetchAnim(key, size));
  }
}
