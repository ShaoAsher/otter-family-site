"""本地路径约定。

otter-library 与 OSS 同构（无 latest/）：
  otter-library/{expr,common,catalog,otter-*}/  ↔  library/{same}/
  otter-library/private/                        ↔  library/private/
"""
from __future__ import annotations

import os

_HUB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # otter-site
_CODE = os.path.dirname(_HUB)

# 公开顶栏（与 App id / 公用区并列，在 library 根下）
PUBLIC_TOPS = frozenset(
    {
        "expr",
        "common",
        "catalog",
        "otter-git",
        "otter-tools",
        "otter-gametime",
    }
)
APPS = ("otter-git", "otter-tools", "otter-gametime")


def library_root() -> str:
    env = os.environ.get("OTTER_LIBRARY")
    if env:
        return os.path.abspath(env)
    return os.path.join(_CODE, "otter-library")


def library_public() -> str:
    """公开交付根 = library 根（与 private 同级的顶栏）。"""
    return library_root()


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
