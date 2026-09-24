# SK7 Visual Factory repository integration

This tooling is candidate intake only. It does not mutate product runtime, `visual/v1/`, `visual/v2/`, `companion/v1/`, or deployment configuration.

- Local archive defaults to `~/SK7-Visual-Factory`, outside Git.
- R2 backup is restricted in code to `sk7-design-corpus-private` under `visual-factory/v1/`.
- Every candidate starts `needs-review` and `runtimeApproved: false`.
- Product-semantic `visual/v2/...` paths are proposal metadata only until a separately reviewed delivery change approves them.
- Public publication, catalog switching, and deletion are deliberately absent.

Run local tests:

```bash
python3 -m unittest discover -s tests -p 'test_visual_factory.py'
```

Initialize local archive:

```bash
python3 tools/visual-factory/visual_factory.py init
python3 tools/visual-factory/visual_factory.py check
```

Configure the reviewed private R2 archive only after read-only privacy checks:

```bash
python3 tools/visual-factory/visual_factory.py configure-r2 --confirm-private-target
```

Start a foreground intake + private backup session:

```bash
python3 tools/visual-factory/visual_factory.py watch --minutes 120 --interval 5 --upload --confirm-private-upload
```
