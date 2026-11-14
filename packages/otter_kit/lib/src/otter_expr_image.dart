import 'dart:io';

import 'package:flutter/material.dart';

import 'otter_expr_store.dart';

/// 小獭表情：静帧走 asset；动图走 [OtterExprStore] 缓存，失败回退静帧。
class OtterExprImage extends StatelessWidget {
  const OtterExprImage({
    super.key,
    required this.exprKey,
    required this.still,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.filterQuality = FilterQuality.medium,
    this.semanticLabel,
    this.gaplessPlayback = true,
    this.color,
    this.colorBlendMode,
  });

  final String exprKey;
  final bool still;
  final double? width;
  final double? height;
  final BoxFit fit;
  final FilterQuality filterQuality;
  final String? semanticLabel;
  final bool gaplessPlayback;
  final Color? color;
  final BlendMode? colorBlendMode;

  Widget _still() => Image.asset(
        OtterExprStore.stillAssetPath(exprKey),
        width: width,
        height: height,
        fit: fit,
        filterQuality: filterQuality,
        semanticLabel: semanticLabel,
        gaplessPlayback: gaplessPlayback,
        color: color,
        colorBlendMode: color == null ? null : colorBlendMode,
        errorBuilder: (_, _, _) => SizedBox(width: width, height: height),
      );

  @override
  Widget build(BuildContext context) {
    if (still) return _still();
  return FutureBuilder<File?>(
      future: OtterExprStore.animFile(exprKey),
      builder: (context, snap) {
        final f = snap.data;
        if (f != null) {
          return Image.file(
            f,
            width: width,
            height: height,
            fit: fit,
            filterQuality: filterQuality,
            semanticLabel: semanticLabel,
            gaplessPlayback: gaplessPlayback,
            color: color,
            colorBlendMode: color == null ? null : colorBlendMode,
            errorBuilder: (_, _, _) => _still(),
          );
        }
        if (snap.connectionState != ConnectionState.done) {
          return _still();
        }
        return _still();
      },
    );
  }
}