import { createRoot } from "react-dom/client";

import { CompanionInteractionLab } from "./CompanionInteractionLab";
import "./transcend-lab.css";

const root = document.getElementById("transcend-lab-root");
if (!root) throw new Error("missing Transcend Lab root");

createRoot(root).render(<CompanionInteractionLab />);
