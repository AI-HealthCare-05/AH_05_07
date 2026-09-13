"""Export an already-fitted linear core supplied on stdin; never fit a model."""

import json
import sys
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper


def main() -> None:
    payload = json.load(sys.stdin)
    coefficients = np.asarray(payload["coefficients"], dtype=np.float64)
    intercept = np.asarray(payload["intercept"], dtype=np.float64)
    if coefficients.shape != (1, 35) or intercept.shape != (1,):
        raise ValueError("Expected the frozen binary 35-column logistic core")
    graph = helper.make_graph(
        [
            helper.make_node("MatMul", ["preprocessed", "weights"], ["linear"]),
            helper.make_node("Add", ["linear", "intercept"], ["logit"]),
            helper.make_node("Sigmoid", ["logit"], ["probability"]),
        ],
        "model-v2-frozen-linear-core-only",
        [helper.make_tensor_value_info("preprocessed", TensorProto.DOUBLE, [None, 35])],
        [helper.make_tensor_value_info("probability", TensorProto.DOUBLE, [None, 1])],
        [
            numpy_helper.from_array(coefficients.T.copy(), "weights"),
            numpy_helper.from_array(intercept, "intercept"),
        ],
    )
    model = helper.make_model(
        graph,
        producer_name="isolated-model-v2-local-spike",
        opset_imports=[helper.make_opsetid("", 13)],
        ir_version=9,
    )
    onnx.checker.check_model(model)
    onnx.save(model, Path(sys.argv[1]))
    print(json.dumps({"onnx": onnx.__version__, "numpy": np.__version__}))


if __name__ == "__main__":
    main()
