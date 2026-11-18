import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'otter_expr_anim.dart';
import 'otter_expr_store.dart';
import 'otter_webp_loop.dart';

/// 小獭表情：静帧走 asset；动图走 [OtterExprStore] + 统一 [OtterWebpLoop]。
///
/// 播放实现与 xspay `YyWebpLoopAnimation` 同路：引擎 codec 自驱，不拆帧、不花屏。
class OtterExprImage extends StatefulWidget {
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

  @override
  State<OtterExprImage> createState() => _OtterExprImageState();
}

class _OtterExprImageState extends State<OtterExprImage> {
  Future<File?>? _file;
  Future<Uint8List?>? _bytes;

  @override
  void initState() {
    super.initState();
    _kick();
  }

  @override
  void didUpdateWidget(covariant OtterExprImage old) {
    super.didUpdateWidget(old);
    if (old.exprKey != widget.exprKey || old.still != widget.still) {
      _file = null;
      _bytes = null;
      _kick();
    }
  }

  void _kick() {
    if (widget.still) {
      debugPrint('[OtterExprImage] ${widget.exprKey} still=true skip');
      return;
    }
    debugPrint('[OtterExprImage] ${widget.exprKey} load anim…');
    _file ??= OtterExprStore.animFile(widget.exprKey);
    _file!.then((f) {
      if (!mounted) return;
      if (f == null) {
        debugPrint('[OtterExprImage] ${widget.exprKey} file=null');
        return;
      }
      _bytes ??= OtterExprAnim.bytesFor(f);
      setState(() {});
    });
  }

  Widget _still() => Image.asset(
        OtterExprStore.stillAssetPath(widget.exprKey),
        width: widget.width,
        height: widget.height,
        fit: widget.fit,
        filterQuality: widget.filterQuality,
        semanticLabel: widget.semanticLabel,
        gaplessPlayback: widget.gaplessPlayback,
        color: widget.color,
        colorBlendMode: widget.color == null ? null : widget.colorBlendMode,
        errorBuilder: (_, _, _) =>
            SizedBox(width: widget.width, height: widget.height),
      );

  @override
  Widget build(BuildContext context) {
    if (widget.still) return _still();
    final bytesFut = _bytes;
    if (bytesFut == null) return _still();
    return FutureBuilder<Uint8List?>(
      future: bytesFut,
      builder: (context, snap) {
        final bytes = snap.data;
        if (bytes == null || bytes.isEmpty) return _still();
        return OtterWebpLoop.memory(
          bytes: bytes,
          width: widget.width,
          height: widget.height,
          fit: widget.fit,
          filterQuality: widget.filterQuality,
          semanticLabel: widget.semanticLabel,
          color: widget.color,
          colorBlendMode: widget.colorBlendMode,
          playing: true,
          fallback: (_) => _still(),
        );
      },
    );
  }
}
