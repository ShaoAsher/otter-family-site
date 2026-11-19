import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import 'family_config.dart';

/// 启动静图 / 视频：优先 TOS `library/latest/{app}/splash/`，失败回落安装包 asset。
///
/// 三端一致：`OtterSplashStore.stillFile(appId)` / [animFile]。
abstract final class OtterSplashStore {
  static const _fallbackBrand =
      'https://otter-family-site.tos-cn-beijing.volces.com/library/latest/';

  static final Map<String, Future<File?>> _still = {};
  static final Map<String, Future<File?>> _anim = {};

  static String get _brandBase {
    final url = FamilyConfig.current.value?.brandAssetsBase ?? '';
    if (url.isNotEmpty) return url;
    return _fallbackBrand;
  }

  static String _normApp(String appId) {
    final id = appId.trim();
    if (id.startsWith('otter-')) return id;
    return 'otter-$id';
  }

  static Future<Directory> _cacheRoot(String appId) async {
    final dir = await getApplicationSupportDirectory();
    final root = Directory('${dir.path}/otter-splash/${_normApp(appId)}');
    if (!root.existsSync()) root.createSync(recursive: true);
    return root;
  }

  /// TOS / 缓存中的 `dart.png`；失败返回 null（界面用 asset）。
  static Future<File?> stillFile(String appId) {
    final id = _normApp(appId);
    return _still.putIfAbsent(id, () => _fetch(id, 'dart.png'));
  }

  /// TOS / 缓存中的 `anim.mp4`；失败返回 null（界面用 asset）。
  static Future<File?> animFile(String appId) {
    final id = _normApp(appId);
    return _anim.putIfAbsent(id, () => _fetch(id, 'anim.mp4'));
  }

  /// 冷启动并行预热（不阻塞首帧 asset）。
  static void prefetch(String appId) {
    unawaited(stillFile(appId));
    unawaited(animFile(appId));
  }

  static Future<File?> _fetch(String appId, String name) async {
    if (kIsWeb) return null;
    try {
      final root = await _cacheRoot(appId);
      final dest = File('${root.path}/$name');
      if (dest.existsSync() && dest.lengthSync() > 512) return dest;
      final url = Uri.parse('$_brandBase$appId/splash/$name');
      final r = await http.get(url).timeout(const Duration(seconds: 45));
      if (r.statusCode != 200) {
        debugPrint('[OtterSplashStore] $appId/$name → HTTP ${r.statusCode}');
        _drop(appId, name);
        return null;
      }
      await dest.parent.create(recursive: true);
      final tmp = '${dest.path}.part';
      await File(tmp).writeAsBytes(r.bodyBytes);
      await File(tmp).rename(dest.path);
      debugPrint('[OtterSplashStore] $appId/$name cached ${r.bodyBytes.length}B');
      return dest;
    } catch (e, st) {
      debugPrint('[OtterSplashStore] $appId/$name failed: $e');
      assert(() {
        debugPrint('$st');
        return true;
      }());
      _drop(appId, name);
      return null;
    }
  }

  static void _drop(String appId, String name) {
    if (name.endsWith('.png')) {
      _still.remove(appId);
    } else {
      _anim.remove(appId);
    }
  }
}
