"""Small numeric SAS v5 fixture writer; synthetic data only, no external writer."""

import math
import struct
from pathlib import Path


def numeric(value: float) -> bytes:
    if math.isnan(value):
        return b"." + b"\0" * 7
    if value == 0:
        return b"\0" * 8
    exponent = math.floor(math.log(abs(value), 16)) + 1
    fraction = int(abs(value) / 16**exponent * 2**56)
    return bytes([(128 if value < 0 else 0) + exponent + 64]) + fraction.to_bytes(7, "big")


def write_xpt(path: Path, columns: list[str], rows: list[list[float]]) -> None:
    def record(value: str) -> bytes:
        return value.encode("ascii").ljust(80, b" ")

    date = "01JAN26:00:00:00"
    data = record("HEADER RECORD*******LIBRARY HEADER RECORD!!!!!!!000000000000000000000000000000")
    data += record("SAS     SAS     SASLIB  ".ljust(24) + "9.4".ljust(8) + "TEST".ljust(8) + " " * 24 + date)
    data += record(date)
    data += record("HEADER RECORD*******MEMBER  HEADER RECORD!!!!!!!000000000000000001600000000140")
    data += record("HEADER RECORD*******DSCRPTR HEADER RECORD!!!!!!!000000000000000000000000000000")
    data += record("SAS     " + "TEST".ljust(8) + "SASDATA " + "9.4".ljust(8) + "TEST".ljust(8) + " " * 24 + date)
    data += record(date)
    data += record(
        "HEADER RECORD*******NAMESTR HEADER RECORD!!!!!!!000000" + f"{len(columns):04d}" + "00000000000000000000"
    )
    names = b""
    for i, name in enumerate(columns):
        names += struct.pack(
            ">hhhh8s40s8shhh2s8shhl52s",
            1,
            0,
            8,
            i + 1,
            name.encode().ljust(8),
            b" " * 40,
            b" " * 8,
            0,
            0,
            0,
            b"  ",
            b" " * 8,
            0,
            0,
            i * 8,
            b" " * 52,
        )
    data += names.ljust(math.ceil(len(names) / 80) * 80, b" ")
    data += record("HEADER RECORD*******OBS     HEADER RECORD!!!!!!!000000000000000000000000000000")
    observations = b"".join(numeric(float(value)) for row in rows for value in row)
    data += observations.ljust(math.ceil(len(observations) / 80) * 80, b" ")
    path.write_bytes(data)
