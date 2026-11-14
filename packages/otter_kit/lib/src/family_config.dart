import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

/// 水獭家族公共配置（otter-family-site 仓库根目录 `family.json`）：
/// 版本记录、官网 / 下载地址、家族官网三端共用，改一处三端生效。
///
/// 不内置：先读上次缓存，再拉远端（TOS，失败再 GitHub Pages）；都没有时 [current] 为 null，界面不显示相关内容。
/// 远端 `schema` 高于 [FamilyConfig.schema] 说明字段不兼容，忽略，继续用手上那份。
/// 三端都依赖本包（otter-family-site/packages/otter_kit），改这里、打 kit-v 标签、各 App 升 ref。
class FamilyConfig {
  FamilyConfig._(this._raw);

  final Map<String, Object?> _raw;

  static const schema = 1;
  static const remotes = [
    'https://otter-family-site.tos-cn-beijing.volces.com/config/family.json',
    'https://shaoasher.github.io/otter-family-site/family.json',
  ];

  /// 当前生效的配置；远端拉到新的会替换并通知。
  static final current = ValueNotifier<FamilyConfig?>(null);

  static Future<bool>? _loading;

  /// 启动时调一次即可，重复调用复用同一次加载。`remote: false` 只读缓存，不联网。
  /// 返回这次是否拿到了远端最新的一份。
  static Future<bool> load({bool remote = true}) =>
      _loading ??= _load(remote: remote);

  /// 「检查版本」这类手动刷新：重新拉一次远端。
  static Future<bool> refresh() => _loading = _load(remote: true);

  static Future<bool> _load({required bool remote}) async {
    final cache = await _cacheFile();
    try {
      if (cache != null && cache.existsSync()) {
        current.value = _parse(await cache.readAsString()) ?? current.value;
      }
    } catch (_) {}
    if (!remote) return false;
    for (final url in remotes) {
      try {
        final r = await http
            .get(Uri.parse(url))
            .timeout(const Duration(seconds: 6));
        if (r.statusCode != 200) continue;
        final body = utf8.decode(r.bodyBytes);
        final cfg = _parse(body);
        if (cfg == null) continue;
        current.value = cfg;
        await cache?.writeAsString(body);
        return true;
      } catch (_) {}
    }
    return false;
  }

  static FamilyConfig? _parse(String text) {
    try {
      final j = jsonDecode(text);
      if (j is! Map<String, Object?>) return null;
      final s = j['schema'];
      if (s is! int || s > schema) return null;
      return FamilyConfig._(j);
    } catch (_) {
      return null;
    }
  }

  static Future<File?> _cacheFile() async {
    try {
      final dir = await getApplicationSupportDirectory();
      return File('${dir.path}/family.json');
    } catch (_) {
      return null;
    }
  }

  @visibleForTesting
  static FamilyConfig? parse(String text) => _parse(text);

  Map<String, Object?> get _family => _map(_raw['family']);

  String get familySite => _str(_family['site']);

  /// 家族官网成员页，`from` 让官网标出「你从这里来」。
  String members(String from) =>
      _str(_family['members']).replaceAll('{from}', from);

  FamilyApp? app(String id) {
    final a = _map(_raw['apps'])[id];
    return a is Map<String, Object?> ? FamilyApp._(a) : null;
  }
}

/// 家族里的一个 App。
class FamilyApp {
  FamilyApp._(this._raw);

  final Map<String, Object?> _raw;

  String get name => _str(_raw['name']);
  String get from => _str(_raw['from']);
  String get site => _str(_raw['site']);
  String get latest => _str(_raw['latest']);

  Map<String, Object?> get _download => _map(_raw['download']);

  /// 能下载到的版本：发布到 TOS 与 GitHub 都齐了才会切过来；没有安装包的 App 就是 [latest]。
  String get available {
    final v = _str(_download['version']);
    return v.isEmpty ? latest : v;
  }

  /// 下载页：产品官网的下载区，国内 / 海外下载源由官网自己选；没有安装包时就是官网。
  String get downloadPage =>
      _download.isEmpty ? site : '${site.split('#').first}#download';

  List<FamilyRelease> get changelog => [
    for (final e in (_raw['changelog'] as List?) ?? const [])
      if (e is Map<String, Object?>) FamilyRelease._(e),
  ];

  /// [available] 比 [current] 新：只提示已经能下载的版本。
  bool hasUpdate(String current) => compareVersions(available, current) > 0;
}

/// 一条版本记录。
class FamilyRelease {
  FamilyRelease._(this._raw);

  final Map<String, Object?> _raw;

  String get version => _str(_raw['version']);
  String get date => _str(_raw['date']);

  /// 正文；要英文而这条没写英文时退回中文。
  String text({bool en = false}) {
    final s = en ? _str(_raw['en']) : '';
    return s.isEmpty ? _str(_raw['zh']) : s;
  }
}

/// 比较 `主.次.补丁`：a 新返回正数，相同 0。
int compareVersions(String a, String b) {
  List<int> parts(String v) => [
    for (final p in v.split('+').first.split('.')) int.tryParse(p) ?? 0,
  ];
  final x = parts(a), y = parts(b);
  for (var i = 0; i < 3; i++) {
    final d = (i < x.length ? x[i] : 0) - (i < y.length ? y[i] : 0);
    if (d != 0) return d;
  }
  return 0;
}

Map<String, Object?> _map(Object? v) =>
    v is Map<String, Object?> ? v : const {};

String _str(Object? v) => v is String ? v : '';
