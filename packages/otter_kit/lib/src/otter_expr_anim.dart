import 'dart:io';

import 'package:flutter/foundation.dart';

/// 表情动图字节缓存（文件 → bytes）；真正播放交给 [OtterWebpLoop]。
abstract final class OtterExprAnim {
  /// 字段名带类型后缀，避免热重载残留旧 `Future<OtterAnimClip?>` 缓存。
  static final Map<String, Future<Uint8List?>> _bytesByPath = {};

  static Future<Uint8List?> bytesFor(File file) {
    return _bytesByPath.putIfAbsent(file.path, () => _load(file));
  }

  static Future<Uint8List?> _load(File file) async {
    final name = file.uri.pathSegments.isEmpty
        ? file.path
        : file.uri.pathSegments.last;
    try {
      final bytes = await file.readAsBytes();
      debugPrint('[OtterExprAnim] $name bytes=${bytes.length}');
      return bytes;
    } catch (e, st) {
      debugPrint('[OtterExprAnim] $name failed: $e');
      assert(() {
        debugPrint('$st');
        return true;
      }());
      _bytesByPath.remove(file.path);
      return null;
    }
  }
}
