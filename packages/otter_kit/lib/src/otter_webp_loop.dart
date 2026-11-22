import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// 动图 WebP / GIF 循环播放（借鉴 xspay `YyWebpLoopAnimation`）。
///
/// **纯 Flutter，无 PlatformView**。自驱 [ui.Codec] + 绝对时间轴，不走 [Image]
/// 内建多帧时钟 —— Android Impeller 上 [Image.memory] 常停第 0 帧；频繁 rebuild
/// 也会把 [Image] 动画卡死。
///
/// 排帧按「会话起点 + Σduration」，解码耗时不叠进节奏；同一时刻只持有一帧位图。
class OtterWebpLoop extends StatefulWidget {
  /// 已读入的字节（OSS 缓存文件等）。
  const OtterWebpLoop.memory({
    super.key,
    required this.bytes,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.filterQuality = FilterQuality.medium,
    this.semanticLabel,
    this.color,
    this.colorBlendMode,
    this.playing = true,
    this.frameMs = 80,
    this.repeat = true,
    this.warmStart,
    this.onFirstFrame,
    this.onCompleted,
    this.fallback,
  }) : asset = null;

  /// Asset 路径（`assets/...`）。
  const OtterWebpLoop.asset({
    super.key,
    required this.asset,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.filterQuality = FilterQuality.medium,
    this.semanticLabel,
    this.color,
    this.colorBlendMode,
    this.playing = true,
    this.frameMs = 80,
    this.repeat = true,
    this.warmStart,
    this.onFirstFrame,
    this.onCompleted,
    this.fallback,
  }) : bytes = null;

  /// 预解码前几帧，挂载即出第 0 帧（冷启动 / 舞台大图）。
  static Future<OtterWebpWarmStart?> prewarmMemory(
    Uint8List bytes, {
    int frames = 2,
    int frameMs = 80,
    String? debugName,
  }) =>
      _prewarm(
        bytes: bytes,
        frames: frames,
        frameMs: frameMs,
        debugName: debugName ?? 'memory',
      );

  static Future<OtterWebpWarmStart?> prewarmAsset(
    String asset, {
    int frames = 2,
    int frameMs = 80,
  }) async {
    try {
      final data = await rootBundle.load(asset);
      final bytes =
          data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
      return _prewarm(
        bytes: bytes,
        frames: frames,
        frameMs: frameMs,
        debugName: asset,
        asset: asset,
      );
    } catch (e, st) {
      debugPrint('[OtterWebpLoop] prewarm $asset failed: $e\n$st');
      return null;
    }
  }

  static Future<OtterWebpWarmStart?> _prewarm({
    required Uint8List bytes,
    required int frames,
    required int frameMs,
    required String debugName,
    String? asset,
  }) async {
    ui.Codec? codec;
    final warm = <_WarmFrame>[];
    try {
      codec = await ui.instantiateImageCodec(bytes);
      final want = frames <= 0
          ? 1
          : (frames > codec.frameCount ? codec.frameCount : frames);
      for (var i = 0; i < want; i++) {
        final info = await codec.getNextFrame();
        final ms = info.duration.inMilliseconds;
        warm.add(
          _WarmFrame(
            info.image,
            ms > 0
                ? Duration(milliseconds: ms)
                : Duration(milliseconds: frameMs),
          ),
        );
      }
      return OtterWebpWarmStart._(
        asset: asset,
        bytes: bytes,
        codec: codec,
        frames: warm,
        frameCount: codec.frameCount,
      );
    } catch (e, st) {
      for (final f in warm) {
        f.image.dispose();
      }
      codec?.dispose();
      debugPrint('[OtterWebpLoop] prewarm $debugName failed: $e\n$st');
      return null;
    }
  }

  final Uint8List? bytes;
  final String? asset;
  final double? width;
  final double? height;
  final BoxFit fit;
  final FilterQuality filterQuality;
  final String? semanticLabel;
  final Color? color;
  final BlendMode? colorBlendMode;
  final bool playing;
  final int frameMs;
  final bool repeat;
  final OtterWebpWarmStart? warmStart;
  final VoidCallback? onFirstFrame;
  final VoidCallback? onCompleted;
  final WidgetBuilder? fallback;

  @override
  State<OtterWebpLoop> createState() => _OtterWebpLoopState();
}

class _WarmFrame {
  const _WarmFrame(this.image, this.duration);
  final ui.Image image;
  final Duration duration;
}

/// [OtterWebpLoop.prewarmMemory] / [prewarmAsset] 产物；交给 [warmStart] 后由组件接管。
class OtterWebpWarmStart {
  OtterWebpWarmStart._({
    required this.asset,
    required Uint8List bytes,
    required ui.Codec codec,
    required List<_WarmFrame> frames,
    required this.frameCount,
  })  : _bytes = bytes,
        _codec = codec,
        _frames = frames;

  final String? asset;
  final int frameCount;

  Uint8List? _bytes;
  ui.Codec? _codec;
  List<_WarmFrame>? _frames;

  void dispose() {
    final frames = _frames;
    _frames = null;
    if (frames != null) {
      for (final f in frames) {
        f.image.dispose();
      }
    }
    _codec?.dispose();
    _codec = null;
    _bytes = null;
  }
}

class _OtterWebpLoopState extends State<OtterWebpLoop> {
  Uint8List? _bytes;
  ui.Codec? _codec;
  ui.Image? _frame;
  Timer? _timer;
  int _gen = 0;
  int _frameIndex = 0;
  bool _parkedAtFirstFrame = false;
  int _frameCount = 0;
  final List<_WarmFrame> _warmFrames = <_WarmFrame>[];
  bool _firstFrameFired = false;
  bool _completedFired = false;
  ui.Codec? _decodingCodec;
  final Stopwatch _clock = Stopwatch();
  int _sessionStartMicros = 0;
  bool _originPending = false;
  static const int _maxLagMicros = 500 * 1000;
  Duration _nominal = Duration.zero;

  @override
  void initState() {
    super.initState();
    _clock.start();
    final warm = widget.warmStart;
    final matchAsset =
        warm != null && warm.asset != null && warm.asset == widget.asset;
    final matchMemory = warm != null && widget.bytes != null;
    if (warm != null && (matchAsset || matchMemory)) {
      _adoptWarmStart(warm);
    } else {
      warm?.dispose();
      unawaited(_load(play: widget.playing));
    }
  }

  @override
  void didUpdateWidget(covariant OtterWebpLoop oldWidget) {
    super.didUpdateWidget(oldWidget);
    final srcChanged = oldWidget.asset != widget.asset ||
        !identical(oldWidget.bytes, widget.bytes);
    if (srcChanged) {
      _bytes = null;
      _clearWarmFrames();
      unawaited(_load(play: widget.playing));
      return;
    }
    if (oldWidget.playing != widget.playing) {
      if (widget.playing && _parkedAtFirstFrame) {
        _resumeFromParkedFirstFrame();
        return;
      }
      _restartForPlayingChange();
    }
  }

  @override
  void dispose() {
    _gen++;
    _cancelTimer();
    final codec = _codec;
    _codec = null;
    if (!identical(codec, _decodingCodec)) codec?.dispose();
    _frame?.dispose();
    _frame = null;
    _clearWarmFrames();
    _bytes = null;
    super.dispose();
  }

  void _clearWarmFrames() {
    for (final f in _warmFrames) {
      f.image.dispose();
    }
    _warmFrames.clear();
  }

  void _adoptWarmStart(OtterWebpWarmStart warm) {
    final gen = ++_gen;
    _bytes = warm._bytes;
    _codec = warm._codec;
    _clearWarmFrames();
    _warmFrames.addAll(warm._frames ?? const <_WarmFrame>[]);
    _frameCount = warm.frameCount;
    warm._bytes = null;
    warm._codec = null;
    warm._frames = null;

    _frameIndex = 0;
    _firstFrameFired = false;
    _completedFired = false;
    _nominal = Duration.zero;
    _originPending = false;

    if (_warmFrames.isEmpty) {
      unawaited(_restart(play: widget.playing));
      return;
    }

    final first = _warmFrames.removeAt(0);
    _frame = first.image;
    _frameIndex = 1;
    _nominal = first.duration;

    if (!widget.playing) {
      _parkedAtFirstFrame = true;
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || gen != _gen) return;
      _sessionStartMicros = _clock.elapsedMicroseconds;
      if (!_firstFrameFired) {
        _firstFrameFired = true;
        widget.onFirstFrame?.call();
      }
      _scheduleTick(
        gen,
        isLast: !widget.repeat && _frameIndex >= _frameCount,
      );
    });
  }

  Future<void> _load({required bool play}) async {
    final gen = ++_gen;
    _cancelTimer();
    try {
      Uint8List bytes;
      final mem = widget.bytes;
      final asset = widget.asset;
      if (mem != null) {
        bytes = mem;
      } else if (asset != null) {
        final data = await rootBundle.load(asset);
        bytes =
            data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
      } else {
        return;
      }
      if (!mounted || gen != _gen) return;
      _bytes = bytes;
      await _startSession(gen, play: play);
    } catch (e, st) {
      debugPrint('[OtterWebpLoop] load failed: $e\n$st');
    }
  }

  void _restartForPlayingChange() {
    if (_bytes == null) {
      unawaited(_load(play: widget.playing));
    } else {
      unawaited(_restart(play: widget.playing));
    }
  }

  Future<void> _restart({required bool play}) async {
    final gen = ++_gen;
    _cancelTimer();
    await _startSession(gen, play: play);
  }

  Future<void> _startSession(int gen, {required bool play}) async {
    final bytes = _bytes;
    if (bytes == null) return;

    _frameIndex = 0;
    _firstFrameFired = false;
    _completedFired = false;
    _nominal = Duration.zero;
    _parkedAtFirstFrame = false;
    _clearWarmFrames();
    _frameCount = 0;

    ui.Codec codec;
    try {
      codec = await ui.instantiateImageCodec(bytes);
    } catch (e, st) {
      debugPrint('[OtterWebpLoop] codec failed: $e\n$st');
      return;
    }
    if (!mounted || gen != _gen) {
      codec.dispose();
      return;
    }

    final old = _codec;
    _codec = codec;
    _frameCount = codec.frameCount;
    if (old != null && !identical(old, _decodingCodec)) old.dispose();

    _originPending = play;
    await _showNextFrame(gen, continuePump: play);
    if (mounted && gen == _gen && !play) _parkedAtFirstFrame = true;
  }

  void _resumeFromParkedFirstFrame() {
    _parkedAtFirstFrame = false;
    final gen = _gen;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || gen != _gen) return;
      _sessionStartMicros = _clock.elapsedMicroseconds;
      _scheduleTick(
        gen,
        isLast: !widget.repeat && _frameIndex >= _frameCount,
      );
    });
  }

  void _cancelTimer() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _showNextFrame(int gen, {required bool continuePump}) async {
    final codec = _codec;
    if (!mounted || codec == null || gen != _gen) return;

    if (_warmFrames.isNotEmpty) {
      final slot = _warmFrames.removeAt(0);
      _presentFrame(slot.image, slot.duration, gen, continuePump: continuePump);
      return;
    }

    _decodingCodec = codec;
    try {
      final info = await codec.getNextFrame();
      if (!mounted || gen != _gen) {
        info.image.dispose();
        return;
      }
      _presentFrame(
        info.image,
        _delayFor(info.duration),
        gen,
        continuePump: continuePump,
      );
    } catch (e, st) {
      debugPrint('[OtterWebpLoop] frame failed: $e\n$st');
    } finally {
      if (identical(_decodingCodec, codec)) _decodingCodec = null;
      if (!identical(codec, _codec)) codec.dispose();
    }
  }

  void _presentFrame(
    ui.Image image,
    Duration duration,
    int gen, {
    required bool continuePump,
  }) {
    if (!mounted || gen != _gen) {
      image.dispose();
      return;
    }
    final prev = _frame;
    setState(() => _frame = image);
    prev?.dispose();
    _frameIndex++;

    if (!_firstFrameFired) {
      _firstFrameFired = true;
      final cb = widget.onFirstFrame;
      if (cb != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && gen == _gen) cb();
        });
      }
    }

    if (!continuePump || !widget.playing) return;

    _nominal += duration;
    final total =
        _frameCount > 0 ? _frameCount : (_codec?.frameCount ?? _frameIndex);
    final isLast = !widget.repeat && _frameIndex >= total;

    if (_originPending) {
      _originPending = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || gen != _gen) return;
        _sessionStartMicros = _clock.elapsedMicroseconds;
        _scheduleTick(gen, isLast: isLast);
      });
      return;
    }

    _scheduleTick(gen, isLast: isLast);
  }

  void _scheduleTick(int gen, {required bool isLast}) {
    _timer?.cancel();
    var waitMicros = _sessionStartMicros +
        _nominal.inMicroseconds -
        _clock.elapsedMicroseconds;
    if (waitMicros < -_maxLagMicros) {
      _sessionStartMicros =
          _clock.elapsedMicroseconds - _nominal.inMicroseconds;
      waitMicros = 0;
    }
    _timer = Timer(
      Duration(microseconds: waitMicros > 0 ? waitMicros : 0),
      () {
        if (!mounted || gen != _gen) return;
        if (isLast) {
          if (_completedFired) return;
          _completedFired = true;
          widget.onCompleted?.call();
          return;
        }
        unawaited(_showNextFrame(gen, continuePump: true));
      },
    );
  }

  Duration _delayFor(Duration? codecDuration) {
    final int ms = codecDuration?.inMilliseconds ?? 0;
    if (ms > 0) return Duration(milliseconds: ms);
    return Duration(milliseconds: widget.frameMs);
  }

  @override
  Widget build(BuildContext context) {
    final frame = _frame;
    if (frame == null) {
      final fb = widget.fallback;
      if (fb != null) return fb(context);
      return SizedBox(width: widget.width, height: widget.height);
    }
    Widget child = RawImage(
      image: frame,
      width: widget.width,
      height: widget.height,
      fit: widget.fit,
      filterQuality: widget.filterQuality,
      color: widget.color,
      colorBlendMode: widget.color == null ? null : widget.colorBlendMode,
    );
    if (widget.semanticLabel != null) {
      child = Semantics(
        label: widget.semanticLabel,
        image: true,
        child: child,
      );
    }
    return RepaintBoundary(child: child);
  }
}
