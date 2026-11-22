import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import 'family_config.dart';

/// 启动素材：OSS `library/latest/brand/{app}/splash/`。
///
/// - `anim.mp4`：仅远端（不进安装包）；**冷启动只用本地缓存**，首次无缓存则静图
/// - `dart.png`：远端优先，失败回落安装包 asset
abstract final class OtterSplashStore {
  static const _fallbackBrand =
      'https://otter.oss-cn-beijing.aliyuncs.com/library/latest/brand/';

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

  /// OSS / 缓存中的 `dart.png`；失败返回 null（界面用 asset）。
  static Future<File?> stillFile(String appId) {
    final id = _normApp(appId);
    return _still.putIfAbsent(id, () => _fetch(id, 'dart.png'));
  }

  /// 仅本地已缓存的 `anim.mp4`；没有则立刻返回 null，**不发起下载**。
  ///
  /// 冷启动请用这个，避免首次等 OSS。后台用 [prefetch] / [animFile] 拉下次用。
  static Future<File?> cachedAnimFile(String appId) async {
    if (kIsWeb) return null;
    try {
      final root = await _cacheRoot(_normApp(appId));
      final dest = File('${root.path}/anim.mp4');
      if (dest.existsSync() && dest.lengthSync() > 512) return dest;
    } catch (_) {}
    return null;
  }

  /// OSS / 缓存中的 `anim.mp4`；会下载。界面冷启动请用 [cachedAnimFile]。
  static Future<File?> animFile(String appId) {
    final id = _normApp(appId);
    return _anim.putIfAbsent(id, () => _fetch(id, 'anim.mp4'));
  }

  /// 后台预热：拉静图 + 视频到缓存，供下次启动播放。
  static void prefetch(String appId) {
    unawaited(animFile(appId));
    unawaited(stillFile(appId));
  }

  static Future<File?> _fetch(String appId, String name) async {
    if (kIsWeb) return null;
    try {
      final root = await _cacheRoot(appId);
      final dest = File('${root.path}/$name');
      final url = Uri.parse('$_brandBase$appId/splash/$name');
      final remoteLen = await _remoteLength(url);
      if (dest.existsSync() &&
          dest.lengthSync() > 512 &&
          (remoteLen == null || remoteLen == dest.lengthSync())) {
        return dest;
      }
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

  static Future<int?> _remoteLength(Uri url) async {
    try {
      final r = await http.head(url).timeout(const Duration(seconds: 8));
      if (r.statusCode != 200) return null;
      return int.tryParse(r.headers['content-length'] ?? '');
    } catch (_) {
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
