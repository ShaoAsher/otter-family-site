"""本地路径约定。

otter-library 与 OSS 同构：
  otter-library/latest/   ↔  library/latest/
  otter-library/private/  ↔  library/private/
"""
from __future__ import annotations

import os

_HUB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # otter-site
_CODE = os.path.dirname(_HUB)


def library_root() -> str:
    env = os.environ.get("OTTER_LIBRARY")
    if env:
        return os.path.abspath(env)
    return os.path.join(_CODE, "otter-library")


def library_latest() -> str:
    return os.path.join(library_root(), "latest")


def library_private() -> str:
    return os.path.join(library_root(), "private")


def hub_root() -> str:
    return _HUB


def family_site() -> str:
    return _HUB


def code_root() -> str:
    return _CODE


def films_root() -> str:
    env = os.environ.get("OTTER_FILMS")
    if env:
        return os.path.abspath(env)
    return os.path.join(_CODE, "otter-films")
