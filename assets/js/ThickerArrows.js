import {
  ARROW_TYPE,
  Arrows,
} from "../vendor/cm-chessboard/src/extensions/arrows/Arrows.js";

//import {Extension, EXTENSION_POINT} from "../../model/Extension.js"
import { Svg } from "../vendor/cm-chessboard/src/lib/Svg.js";
//import {Utils} from "../../lib/Utils.js"

export const CUSTOM_ARROW_TYPE = {
  thin: {
    class: "arrow-thick",
    slice: "arrowThick",
    headSize: 8,
    strokeWidth: 4,
  },
  normal: {
    class: "arrow-thick",
    slice: "arrowThick",
    headSize: 6,
    strokeWidth: 6,
  },
  thick: {
    class: "arrow-thick",
    slice: "arrowThick",
    headSize: 6,
    strokeWidth: 8,
  },
  thicker: {
    class: "arrow-thick",
    slice: "arrowThick",
    headSize: 5,
    strokeWidth: 10,
  },
  thickest: {
    class: "arrow-thick",
    slice: "arrowThick",
    headSize: 5,
    strokeWidth: 12,
  },
};

export class ThickerArrows extends Arrows {
  /** @constructor */
  constructor(chessboard, props = {}) {
    super(chessboard);
  }

  drawArrow(arrow) {
    const arrowsGroup = Svg.addElement(this.arrowGroup, "g");
    arrowsGroup.setAttribute("data-arrow", arrow.from + arrow.to);
    arrowsGroup.setAttribute("class", "arrow " + arrow.type.class);
    const view = this.chessboard.view;
    const sqfrom = document.querySelectorAll(
      '[data-square="' + arrow.from + '"]'
    )[0];
    const sqto = document.querySelectorAll(
      '[data-square="' + arrow.to + '"]'
    )[0];
    const spriteUrl = this.chessboard.props.assetsCache
      ? ""
      : this.getSpriteUrl();
    const defs = Svg.addElement(arrowsGroup, "defs");
    const id = "arrow-" + arrow.from + arrow.to;
    const marker = Svg.addElement(defs, "marker", {
      id: id,
      markerWidth: arrow.type.headSize,
      markerHeight: arrow.type.headSize,
      //markerUnits: "userSpaceOnUse",
      refX: 20,
      refY: 20,
      viewBox: "0 0 40 40",
      orient: "auto",
      class: "arrow-head",
    });

    const ignored = Svg.addElement(marker, "use", {
      href: `${spriteUrl}#${arrow.type.slice}`,
    });

    const x1 = sqfrom.x.baseVal.value + sqfrom.width.baseVal.value / 2;
    const x2 = sqto.x.baseVal.value + sqto.width.baseVal.value / 2;
    const y1 = sqfrom.y.baseVal.value + sqfrom.height.baseVal.value / 2;
    const y2 = sqto.y.baseVal.value + sqto.height.baseVal.value / 2;

    var strokeWidth = arrow.type.strokeWidth ? arrow.type.strokeWidth : 4;

    const width = ((view.scalingX + view.scalingY) / 2) * strokeWidth;

    let lineFill = Svg.addElement(arrowsGroup, "line");
    lineFill.setAttribute("x1", x1.toString());
    lineFill.setAttribute("x2", x2.toString());
    lineFill.setAttribute("y1", y1.toString());
    lineFill.setAttribute("y2", y2.toString());
    lineFill.setAttribute("class", "arrow-line");
    lineFill.setAttribute("marker-end", "url(#" + id + ")");
    lineFill.setAttribute("stroke-width", width + "px");
  }
}
