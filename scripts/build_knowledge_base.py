#!/usr/bin/env python3
"""Combine Markdown documentation files into one knowledge-base file."""

from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path


MARKDOWN_EXTENSIONS = {".md", ".mdx"}
SKIP_DIRS = {".git", ".obsidian", ".trash", "node_modules", "__pycache__"}
GENERATED_MARKER = "<!-- generated-by: scripts/build_knowledge_base.py -->"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a single Markdown knowledge-base file from docs."
    )
    parser.add_argument(
        "root",
        nargs="?",
        default=".",
        help="Directory to scan for Markdown files. Default: current directory.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="knowledge-base.md",
        help="Output Markdown file. Default: knowledge-base.md",
    )
    parser.add_argument(
        "--title",
        default="Documentation Knowledge Base",
        help="Title used at the top of the generated file.",
    )
    return parser.parse_args()


def is_generated_file(path: Path) -> bool:
    try:
        return GENERATED_MARKER in path.read_text(encoding="utf-8", errors="ignore")[:500]
    except OSError:
        return False


def should_skip(path: Path, output: Path) -> bool:
    if path.resolve() == output.resolve():
        return True
    if any(part in SKIP_DIRS for part in path.parts):
        return True
    if path.suffix.lower() not in MARKDOWN_EXTENSIONS:
        return True
    return is_generated_file(path)


def collect_markdown_files(root: Path, output: Path) -> list[Path]:
    files = [path for path in root.rglob("*") if path.is_file() and not should_skip(path, output)]
    return sorted(files, key=lambda path: path.relative_to(root).as_posix().lower())


def anchor_for(index: int) -> str:
    return f"doc-{index}"


def read_text(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    return text.rstrip()


def build_document(root: Path, output: Path, title: str, files: list[Path]) -> str:
    generated_at = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    lines: list[str] = [
        GENERATED_MARKER,
        "",
        f"# {title}",
        "",
        f"Generated: {generated_at}",
        f"Source root: `{root.resolve()}`",
        f"Files: {len(files)}",
        "",
        "## Table of Contents",
        "",
    ]

    for index, path in enumerate(files, start=1):
        relative_path = path.relative_to(root).as_posix()
        lines.append(f"- [{relative_path}](#{anchor_for(index)})")

    lines.extend(["", "---", ""])

    for index, path in enumerate(files, start=1):
        relative_path = path.relative_to(root).as_posix()
        content = read_text(path)
        lines.extend(
            [
                f'<a id="{anchor_for(index)}"></a>',
                "",
                f"## {relative_path}",
                "",
                f"Source: `{relative_path}`",
                "",
                content if content else "_Empty file._",
                "",
                "---",
                "",
            ]
        )

    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    args = parse_args()
    root = Path(args.root).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()

    if not root.exists():
        raise SystemExit(f"Root directory does not exist: {root}")
    if not root.is_dir():
        raise SystemExit(f"Root path is not a directory: {root}")

    files = collect_markdown_files(root, output)
    document = build_document(root, output, args.title, files)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(document, encoding="utf-8")

    print(f"Wrote {output}")
    print(f"Included {len(files)} Markdown files from {root}")


if __name__ == "__main__":
    main()
