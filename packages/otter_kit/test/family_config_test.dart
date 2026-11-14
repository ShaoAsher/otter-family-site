import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:otter_kit/otter_kit.dart';

void main() {
  test('本仓 family.json 能解析，三个 App 都在', () {
    final cfg = FamilyConfig.parse(File('../../family.json').readAsStringSync())!;
    for (final id in ['git', 'tools', 'gametime']) {
      expect(cfg.app(id), isNotNull, reason: id);
    }
  });

  test('schema 高于本包的配置不认', () {
    expect(FamilyConfig.parse('{"schema":${FamilyConfig.schema + 1}}'), isNull);
    expect(FamilyConfig.parse('[]'), isNull);
  });

  test('只提示已经能下载的版本；下载页是产品官网的下载区', () {
    final cfg = FamilyConfig.parse(
      '{"schema":1,"apps":{'
      '"a":{"site":"https://x/a/","latest":"3.0.0","download":{"version":"2.0.7"}},'
      '"b":{"site":"https://x/#b","latest":"3.0.0"}}}',
    )!;
    final a = cfg.app('a')!, b = cfg.app('b')!;
    expect(
      (a.available, a.hasUpdate('2.0.7'), a.downloadPage),
      ('2.0.7', false, 'https://x/a/#download'),
    );
    expect(
      (b.available, b.hasUpdate('2.0.7'), b.downloadPage),
      ('3.0.0', true, 'https://x/#b'),
    );
  });

  test('版本比较只看主.次.补丁', () {
    expect(compareVersions('3.0.10', '3.0.9'), greaterThan(0));
    expect(compareVersions('3.0.0+19', '3.0.0'), 0);
    expect(compareVersions('2.9', '3.0.0'), lessThan(0));
  });
}
