#!/usr/bin/env python3
import os
import runpy
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pkg = os.path.join(root, "py", "cp%d%d" % sys.version_info[:2])
if not os.path.isdir(pkg):
    sys.exit(0)
sys.argv[0] = os.path.join(pkg, "hooks", "chekan_hook.pyc")
runpy.run_path(sys.argv[0], run_name="__main__")
