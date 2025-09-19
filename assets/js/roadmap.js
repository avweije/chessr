import { Utils } from "utils";

/**
 * Controller class for the practice page.
 */
class Roadmap {
  roadmapIntro = null;
  roadmapIntroText = null;
  roadmapDetails = null;
  roadmapDetailsEco = null;
  roadmapDetailsPgn = null;
  roadmapTreeCurrentButtons = null;
  roadmapDetailsAccuracy = null;

  roadmapForm = {
    form: null,
    id: null,
    color: null,
    pgn: null,
    fen: null,
    line: null,
  };

  roadmapTreePath = null;
  roadmapTreeCurrent = null;
  roadmapTreeCurrentField = null;
  roadmapTreeContainer = null;

  // the roadmap data
  roadmap = [];

  // keep track of the selected moves per level, so we have the entire tree to walk through
  tree = [];

  constructor() {
    // Get the elements
    this.getElements();
    // Add the listeners
    this.addListeners();
    // get the roadmap
    this.getRoadmap();
  }

  // Get the data-elements
  getElements() {
    // Get the data-elements for reference
    this.elements = {};
    document.querySelectorAll("[data-element]").forEach(el => {
      if (el.dataset.element !== "yes") return;
      const elementId = el.getAttribute('id');
      this.elements[elementId] = el;
    });

    console.log('Element:', this.elements);
  }

  // Add event listeners
  addListeners() {
    // Add event listeners
    this.elements.roadmapWhite.addEventListener(
      "click",
      (event) => {
        this.showRoadmapType("white");
      }
    );
    this.elements.roadmapBlack.addEventListener(
      "click",
      (event) => {
        this.showRoadmapType("black");
      }
    );

    this.elements.openInRepertoireLink.addEventListener("click", () => {
      document.forms["roadmapForm"].action = "./repertoire";
      document.forms["roadmapForm"].submit();
    });
    this.elements.openInPracticeLink.addEventListener("click", () => {
      document.forms["roadmapForm"].action = "./practice";
      document.forms["roadmapForm"].submit();
    });
  }
  
  // get the currently selected color
  getCurrentColor() {
    return this.elements.roadmapTypeButtons.children[0].children[0].checked
      ? "white"
      : "black";
  }

  // toggle white/black
  showRoadmapType(type) {

    console.log('showRoadmapType');

    // show the roadmap intro
    this.showRoadmapIntro();
    // load the roadmap tree
    this.loadRoadmapTree();
  }

  // show the roadmap intro text
  showRoadmapIntro() {
    this.elements.roadmapIntro.classList.remove("is-hidden");
    this.elements.roadmapDetails.classList.add("is-hidden");
  }

  // show the roadmap details
  showRoadmapDetails(line) {
    // update the info
    this.elements.roadmapDetailsEco.innerHTML = line.eco.name;
    this.elements.roadmapDetailsPgn.innerHTML = line.pgn;
    this.elements.roadmapDetailsAccuracy.innerHTML =
      Math.round((1 - line.fail) * 100) + "%";

    // updat the info in the form
    this.elements.roadmapIdInput.value = line.id;
    this.elements.roadmapColorInput.value = line.color;
    this.elements.roadmapPgnInput.value = line.pgn;
    this.elements.roadmapFenInput.value = "";

    // remove the existing line[] fields
    var inps = Array.from(this.elements.roadmapForm.getElementsByTagName("input"));
    for (var i = 0; i < inps.length; i++) {
      if (inps[i].name == "line[]") {
        this.elements.roadmapForm.removeChild(inps[i]);
      }
    }

    // add the new line[] fields
    for (var i = 0; i < line.line.length; i++) {
      var inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = "line[]";
      inp.value = line.line[i];

      this.elements.roadmapForm.appendChild(inp);
    }

    // show the details
    this.elements.roadmapIntro.classList.add("is-hidden");
    this.elements.roadmapDetails.classList.remove("is-hidden");
  }

  // get the roadmap
  getRoadmap() {
    // show the page loader
    Utils.showLoading();

    var url = "/api/roadmap";

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // load the roadmap
        this.onGetRoadmap(response);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      })
      .finally(() => {
        // hide the page loader
        Utils.hideLoading();
      });
  }

  onGetRoadmap(roadmap) {
    // store the settings
    this.roadmap = roadmap;

    // load the roadmap tree top level
    this.loadRoadmapTree();
  }

  // Load the roadmap tree
  loadRoadmapTree(tree = []) {
    var color = this.getCurrentColor();

    // Reset the tree
    this.tree = tree;

    console.info("loadRoadmapTree:", color, this.elements);

    // get the data
    var data = this.roadmap[color];
    for (var i = 0; i < this.tree.length; i++) {
      data = data[this.tree[i]].lines;
    }

    // hide the missing moves
    this.elements.roadmapTreeMissingMoves.classList.add("is-hidden");

    // load the tree current (ECO, PGN)
    this.loadTreeCurrent();
    // load the tree path
    this.loadTreePath();
    // load the tree
    this.loadTree(data, this.elements.roadmapTreeContainer);
  }

  loadTreePath() {
    // clear the path container
    while (this.elements.roadmapTreePath.firstChild) {
      this.elements.roadmapTreePath.removeChild(this.elements.roadmapTreePath.lastChild);
    }

    // get the data
    var color = this.getCurrentColor();
    var data = this.roadmap[color];

    console.info("loadTreePath:", this.tree, this.tree.length);

    if (this.tree.length > 0) {
      var variation = this.createPathItem(null);
      this.elements.roadmapTreePath.appendChild(variation);
    }

    // add the tree path
    for (var i = 0; i < this.tree.length; i++) {

      data = i == 0 ? data[this.tree[i]] : data.lines[this.tree[i]];

      console.info("treePath:", i, this.tree[i], data);

      var variation = this.createPathItem(data, i);

      this.elements.roadmapTreePath.appendChild(variation);
    }
  }

  loadTreeCurrent() {
    console.info("loadTreeCurrent:", this.tree, this.tree.length);

    // if we have no tree
    if (this.tree.length == 0) {
      // hide the tree current
      this.elements.roadmapTreeCurrent.classList.add("is-hidden");
      // show the intro text
      this.elements.roadmapIntroText.classList.remove("is-hidden");

      return true;
    }

    // hide the intro text
    this.elements.roadmapIntroText.classList.add("is-hidden");
    // show the tree current
    this.elements.roadmapTreeCurrent.classList.remove("is-hidden");

    // get the color
    var color = this.getCurrentColor();

    // get the currently selected data
    var data = this.roadmap[color];
    for (var i = 0; i < this.tree.length; i++) {
      data = i == 0 ? data[this.tree[i]] : data.lines[this.tree[i]];
    }

    console.info("data:", data);

    // show the current ECO and PGN
    this.elements.roadmapTreeCurrentField.innerHTML = data.eco
      ? data.eco.name +
        ' (<span>' +
        data.pgn +
        "</span>)"
      : data.pgn;
  }

  // load the missing moves container and show it
  loadMissingMoves(missing, event) {
    console.info("loadMissingMoves", missing, event);
    console.info(
      this.elements.roadmapTreeMissingMoves,
      this.elements.roadmapTreeMissingMoves.firstElementChild
    );

    // clear current rows
    while (this.elements.roadmapTreeMissingMoves.firstElementChild.firstChild) {
      this.elements.roadmapTreeMissingMoves.firstElementChild.removeChild(
        this.elements.roadmapTreeMissingMoves.firstElementChild.lastChild
      );
    }

    // add the header row
    var div = document.createElement("div");
    div.className =
      "is-flex is-justify-content-center is-align-items-center is-rounded is-size-7 has-text-centered p-2";
    //div.innerHTML = "%";

    var sp = document.createElement("span");
    sp.className = "tc-sharp";
    sp.innerHTML = '<i class="fa-solid fa-medal"></i>';

    div.appendChild(sp);

    this.elements.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

    div = document.createElement("div");
    div.className = "is-size-6 has-text-weight-medium p-2";
    div.innerHTML = "ECO";

    this.elements.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

    div = document.createElement("div");
    div.className = "is-size-6 has-text-weight-medium p-2";
    div.innerHTML = "PGN";

    this.elements.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

    div = document.createElement("div");
    div.className = "is-size-6 has-text-weight-medium has-text-centered p-2 pr-4";
    div.innerHTML = "Response";

    this.elements.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

    // get the missing moves
    var moves = [];
    for (var i = 0; i < missing.length; i++) {
      for (var x = 0; x < missing[i].missing.length; x++) {
        moves.push({
          id: missing[i].id,
          eco: missing[i].eco,
          line: missing[i].line,
          move: missing[i].missing[x].move,
          percentage: missing[i].missing[x].percentage,
          pgn: missing[i].pgn,
        });
      }
    }

    // sort by percentage played
    moves.sort((a, b) => {
      if (a.percentage > b.percentage) return -1;
      if (a.percentage < b.percentage) return 1;
      return 0;
    });

    // add the missing moves
    for (var i = 0; i < moves.length; i++) {
      //
      var row = document.createElement("div");
      row.className = "grid-row-hover is-contents cursor-pointer";

      // add the percentage played
      div = document.createElement("div");
      div.className = "is-rounded is-size-6 has-text-centered p-2";
      div.innerHTML = moves[i].percentage + "%";
      div.addEventListener(
        "click",
        this.onOpenMissingMove.bind(this, moves[i])
      );

      row.appendChild(div);
      //this.elements.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

      // add the ECO
      div = document.createElement("div");
      div.className = "is-rounded is-size-6 p-2";
      div.innerHTML = moves[i].eco.name;
      div.addEventListener(
        "click",
        this.onOpenMissingMove.bind(this, moves[i])
      );

      row.appendChild(div);
      //this.elements.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

      // add the PGN
      div = document.createElement("div");
      div.className = "is-rounded is-size-6 p-2";
      div.innerHTML = moves[i].pgn;
      div.addEventListener(
        "click",
        this.onOpenMissingMove.bind(this, moves[i])
      );

      row.appendChild(div);
      //this.elements.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

      // add the move
      div = document.createElement("div");
      div.className = "is-rounded is-size-6 text-center p-2";
      div.innerHTML = moves[i].move;
      div.addEventListener(
        "click",
        this.onOpenMissingMove.bind(this, moves[i])
      );

      row.appendChild(div);

      this.elements.roadmapTreeMissingMoves.firstElementChild.appendChild(row);
    }

    // show the missing moves
    this.elements.roadmapTreeMissingMoves.classList.remove("is-hidden");
  }

  //
  onOpenMissingMove(move, event) {
    console.info("onOpenMissingMove", move, event);

    this.openIn(move, "./repertoire");
  }

  //
  createPathItem(data, index = -1) {
    console.info("createPathItem:", data, index);

    // the accuracy colors
    var colors = [
      ["accuracy-red", "accuracy-red-hover"],
      ["accuracy-orange", "accuracy-orange-hover"],
      ["accuracy-green", "accuracy-green-hover"],
    ];

    //
    var variation = document.createElement("div");
    variation.id = "roadmapTreeItem_" + (data !== null ? data.id : "root");
    variation.className =
      "box is-rounded is-hoverable p-1 m-0 is-relative is-flex is-flex-direction-column is-flex-shrink-0 is-flex-grow-0 is-justify-content-center gap-y-px";
    if (data !== null) {
      variation.setAttribute("data-id", data.id);
      variation.setAttribute("data-level", index);
    }
    //
    var clickable = document.createElement("label");
    clickable.className =
      "is-flex is-justify-content-space-between is-align-items-center is-flex-grow-1 cursor-pointer";
    //
    if (data !== null) {
      //
      var move =
        Math.ceil(data.line.length / 2) +
        "." +
        (data.line.length % 2 == 0 ? ".." : "") +
        " " +
        (data.move !== "" ? data.move : data.line[data.line.length - 1]);
      //
      var pgn = document.createElement("span");
      pgn.className = "has-text-weight-medium whitespace-nowrap px-3 py-2";
      pgn.innerHTML = move;

      var accuracyIdx = Math.max(0, Math.ceil((1 - data.fail) * 3) - 1);

      var accuracy = document.createElement("span");
      accuracy.className =
        "is-flex is-align-items-center has-text-weight-medium is-size-6 px-2 py-2 " +
        colors[accuracyIdx][0];
      //
      var icon = document.createElement("span");
      icon.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
      //
      var percentage = document.createElement("span");
      percentage.className = "";
      percentage.innerHTML = Math.round((1 - data.fail) * 100) + "%";
      //
      accuracy.appendChild(icon);
      accuracy.appendChild(percentage);
      //
      clickable.appendChild(pgn);
      clickable.appendChild(accuracy);
    } else {
      //
      clickable.className = clickable.className + " px-3";
      //
      var icon = document.createElement("span");
      icon.innerHTML = '<i class="fa-solid fa-house-chimney"></i>';
      //
      clickable.appendChild(icon);
    }

    variation.appendChild(clickable);
    //
    variation.addEventListener(
      "click",
      this.onClickTreeItem.bind(
        this,
        data !== null ? data.id : null,
        index !== -1 ? this.tree[index] : null
      )
    );

    return variation;
  }

  //
  loadTree(data, parent = null, level = 0) {
    console.info("loadTree", parent);
    console.info(data);

    // the accuracy colors
    var colors = [
      ["accuracy-red", "accuracy-red-hover"],
      ["accuracy-orange", "accuracy-orange-hover"],
      ["accuracy-green", "accuracy-green-hover"],
    ];

    // clear the tree container
    while (this.elements.roadmapTreeContainer.firstChild) {
      this.elements.roadmapTreeContainer.removeChild(
        this.elements.roadmapTreeContainer.lastChild
      );
    }

    data.sort((a, b) => {
      if (a.mcount > b.mcount) return -1;
      if (a.mcount < b.mcount) return 1;
      return 0;
    });

    //
    var groupId = this.tree.join("_");
    //
    var row = document.createElement("div");
    row.id = "roadmapTreeRow_" + groupId;
    row.className = "is-flex is-flex-wrap-wrap is-justify-content-center is-gap-1";
    row.setAttribute("data-type", "tree-row");
    row.setAttribute("data-level", level);

    //
    for (var i = 0; i < data.length; i++) {
      console.info(i, data[i]);

      //
      var variation = document.createElement("div");
      variation.id = "roadmapTreeItem_" + data[i].id;
      variation.className =
        "box is-hoverable roadmap-tree-item p-2 m-0 is-relative is-flex is-flex-direction-column is-flex-shrink-0 is-flex-grow-0 is-justify-content-center";
      variation.setAttribute("data-id", data[i].id);
      variation.setAttribute("data-level", level);
      //
      var radio = document.createElement("input");
      radio.id = "roadmapTreeRadio_" + data[i].id;
      radio.name = "roadmapTreeRadio_" + groupId;
      radio.type = "radio";
      radio.className = "is-hidden peer";
      //
      if (data[i].lines.length > 0) {
        console.info("RADIO-CLICK:", data[i].id, i);

        radio.addEventListener(
          "click",
          this.onClickTreeItem.bind(this, data[i].id, i)
        );
      }
      //
      variation.appendChild(radio);
      //
      var clickable = document.createElement("label");
      clickable.htmlFor = "roadmapTreeRadio_" + data[i].id;
      clickable.className =
        "is-flex is-flex-direction-column is-flex-grow-1" +
        (data[i].lines.length > 0 ? " cursor-pointer" : "");
      //
      var header = document.createElement("div");
      header.className = "is-flex is-justify-content-space-between is-align-items-center";
      //
      var move =
        Math.ceil(data[i].line.length / 2) +
        "." +
        (data[i].line.length % 2 == 0 ? ".." : "") +
        " " +
        (data[i].move !== ""
          ? data[i].move
          : data[i].line[data[i].line.length - 1]);
      //
      var pgn = document.createElement("span");
      pgn.className = "has-text-weight-medium px-3 pt-2";
      pgn.innerHTML = move;

      var accuracyIdx = Math.max(0, Math.ceil((1 - data[i].fail) * 3) - 1);

      var accuracy = document.createElement("span");
      accuracy.className =
        "is-flex  is-align-items-center self-start has-text-weight-medium is-size-6 px-2 pt-2 " +
        colors[accuracyIdx][0];

      var icon = document.createElement("span");
      icon.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';

      var percentage = document.createElement("span");
      percentage.className = "";
      percentage.innerHTML = Math.round((1 - data[i].fail) * 100) + "%";

      accuracy.appendChild(icon);
      accuracy.appendChild(percentage);

      header.appendChild(pgn);
      header.appendChild(accuracy);
      
      var main = document.createElement("div");
      main.className = "is-flex is-flex-direction-column is-justify-content-space-between is-flex-grow-1 px-3 pb-3 pt-1";

      var eco = document.createElement("div");
      eco.className = "is-size-6";
      eco.innerHTML =
        data[i].eco && data[i].eco.name ? data[i].eco.name : data[i].pgn;

      var cntrs = document.createElement("div");
      cntrs.className = "is-flex is-justify-content-space-between is-size-7 has-text-faded pt-2";

      // show number of moves in this line
      var sp = document.createElement("span");
      sp.innerHTML =
        '<span class="has-text-weight-medium">' +
        data[i].mcount +
        "</span> move" +
        (data[i].mcount == 1 ? "" : "s");

      cntrs.appendChild(sp);

      // show number of variations in this line
      if (data[i].vcount > 0) {
        sp = document.createElement("span");
        sp.innerHTML =
          '<span class="has-text-weight-medium">' +
          data[i].vcount +
          "</span> variation" +
          (data[i].vcount == 1 ? "" : "s");

        cntrs.appendChild(sp);
      }

      //
      main.appendChild(eco);
      main.appendChild(cntrs);

      //
      clickable.appendChild(header);
      clickable.appendChild(main);
      //
      var footer = document.createElement("div");
      footer.className =
        "is-flex is-justify-content-end  is-align-items-center";

      // if there are any variations
      if (data[i].vcount > 0) {
        // find the lowest accuracy in this line
        var lowestAcc = this.findLowestAccuracy(data[i].lines);

        console.info("lowestAcc", lowestAcc);

        // only show it if it's lower than the current
        if (lowestAcc.fail > data[i].fail) {
          //
          accuracyIdx = Math.max(0, Math.ceil((1 - lowestAcc.fail) * 3) - 1);

          //
          var lowest = document.createElement("span");
          lowest.title = "Lowest accuracy variation";
          lowest.className =
            "cursor-pointer is-flex is-align-items-center px-2 py-1 " +
            colors[accuracyIdx][0] +
            " " +
            colors[accuracyIdx][1];

          //
          // find the lowest accuracy in this line
          //
          // make sure we can jump directly to that line
          //
          // get the accuracyIdx for it
          //
          // get the right color to display it
          //

          sp = document.createElement("span");
          sp.innerHTML = '<i class="fa-solid fa-arrow-trend-down"></i>';

          lowest.appendChild(sp);

          sp = document.createElement("span");
          sp.className = "px-1 text-sm";
          sp.innerHTML = Math.round((1 - lowestAcc.fail) * 100) + "%";

          lowest.appendChild(sp);

          lowest.addEventListener(
            "click",
            this.loadRoadmapTree.bind(this, [
              ...this.tree,
              i,
              ...lowestAcc.tree.slice(0, lowestAcc.tree.length - 1),
            ])
          );

          footer.appendChild(lowest);
        }
      } else {
        //
        var last = document.createElement("span");
        last.title = "Last variation in line";
        last.className = "px-2 py-1";

        sp = document.createElement("span");
        sp.innerHTML = '<i class="fa-solid fa-arrow-turn-down"></i>';

        last.appendChild(sp);

        footer.appendChild(last);
      }


      var missingMoves = this.findMissingTopPlayedMoves(data[i].lines);
      if (missingMoves.length > 0) {

        var total = 0;
        for (var x = 0; x < missingMoves.length; x++) {
          total += missingMoves[x].missing.length;
        }

        var missing = document.createElement("span");
        missing.title = "Missing top responses";
        missing.className =
          "cursor-pointer is-flex  is-align-items-center px-2 py-1";

        sp = document.createElement("span");
        sp.innerHTML = '<i class="fa-solid fa-medal"></i>';

        missing.appendChild(sp);

        sp = document.createElement("span");
        sp.className = "px-1 text-sm";
        sp.innerHTML = total;

        missing.appendChild(sp);

        missing.addEventListener(
          "click",
          this.loadMissingMoves.bind(this, missingMoves)
        );

        footer.appendChild(missing);
      }

      //
      var repertoire = document.createElement("span");
      repertoire.title = "Open in repertoire";
      repertoire.className =
        "cursor-pointer is-flex is-align-items-center px-2 py-1";

      sp = document.createElement("span");
      sp.innerHTML = '<i class="fa-solid fa-chess-board"></i>';

      repertoire.appendChild(sp);

      repertoire.addEventListener(
        "click",
        this.onOpenInRepertoire.bind(this, data[i])
      );

      //
      var practice = document.createElement("span");
      practice.title = "Open in practice";
      practice.className =
        "cursor-pointer flex  is-align-items-center px-2 py-1 tc-link-shade";

      sp = document.createElement("span");
      sp.innerHTML = '<i class="fa-solid fa-gamepad"></i>';

      practice.appendChild(sp);

      practice.addEventListener(
        "click",
        this.onOpenInPractice.bind(this, data[i])
      );

      //
      footer.appendChild(repertoire);
      footer.appendChild(practice);
      //
      variation.appendChild(clickable);
      variation.appendChild(footer);

      row.appendChild(variation);
    }

    // add this row as 1st child (keep the children container as last)
    parent.appendChild(row);
  }

  findLowestAccuracy(lines, highest = 0, tree = []) {
    //
    var highestTree = tree;
    //
    for (var i = 0; i < lines.length; i++) {
      //
      if (lines[i].fail > highest) {
        //
        highest = lines[i].fail;
        highestTree = [...tree, i];

        //console.info(highest, highestTree);
      }
      //
      if (lines[i].lines.length > 0) {
        //
        var ret = this.findLowestAccuracy(lines[i].lines, highest, [
          ...tree,
          i,
        ]);

        if (ret.fail > highest) {
          highest = ret.fail;
          highestTree = ret.tree;
        }

        //console.info(ret);
      }
    }

    return {
      fail: highest,
      tree: highestTree,
    };
  }

  openIn(line, action = "./repertoire") {
    // updat the info in the form
    this.elements.roadmapIdInput.value = line.id;
    this.elements.roadmapColorInput.value = this.getCurrentColor();
    this.elements.roadmapPgnInput.value = line.pgn;
    this.elements.roadmapPgnInput.value = "";
    this.elements.roadmapFenInput.value = "";

    console.log(this, this.elements, this.elements.roadmapForm);

    // remove the existing line[] fields
    var inps = Array.from(this.elements.roadmapForm.getElementsByTagName("input"));
    for (var i = 0; i < inps.length; i++) {
      if (inps[i].name == "line[]") {
        this.elements.roadmapForm.removeChild(inps[i]);
      }
    }

    // add the new line[] fields
    for (var i = 0; i < line.line.length; i++) {
      var inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = "line[]";
      inp.value = line.line[i];

      this.elements.roadmapForm.appendChild(inp);
    }

    // submit the form
    document.forms["roadmapForm"].action = action;
    document.forms["roadmapForm"].submit();
  }

  onOpenInRepertoire(line, event) {
    console.info("onOpenInRepertoire:", line);

    this.openIn(line, "./repertoire");
  }

  onOpenInPractice(line, event) {
    console.info("onOpenInPractice:", line);

    this.openIn(line, "./practice");
  }

  findMissingTopPlayedMoves(lines, tree = []) {
    //
    var missing = [];
    //
    for (var i = 0; i < lines.length; i++) {
      //
      if (lines[i].missing.length > 0) {
        //
        missing.push({
          id: lines[i].id,
          eco: lines[i].eco,
          before: lines[i].before,
          move: lines[i].move,
          pgn: lines[i].pgn,
          line: lines[i].line,
          missing: lines[i].missing,
          tree: [...tree, i],
        });
      }
      //
      var ret = this.findMissingTopPlayedMoves(lines[i].lines, [...tree, i]);

      missing = [...missing, ...ret];
    }

    return missing;
  }

  onClickTreeItem(id, index, event) {
    console.info("onClickTreeItem", id, index);

    var level = 0;

    // find the item
    if (id !== null) {
      var item = document.getElementById("roadmapTreeItem_" + id);
      if (item == null) {
        return false;
      }
      // get the level
      level = parseInt(item.getAttribute("data-level"));

      console.info("item:", item, level);
    }

    console.info("level:", level);

    // override the tree from this level
    this.tree.splice(level, this.tree.length - level);
    if (index !== null) {
      this.tree.push(index);
    }

    console.info("tree:", this.tree.length, level);

    // load the tree path
    this.loadTreePath();

    // load the tree current
    this.loadTreeCurrent();

    // hide the missing moves
    this.elements.roadmapTreeMissingMoves.classList.add("is-hidden");

    // get the color
    var color = this.getCurrentColor();

    // get the data
    var data = this.roadmap[color];
    for (var i = 0; i < this.tree.length; i++) {
      data = data[this.tree[i]].lines;
    }

    console.info("data:", data, this.roadmap[color]);

    // get the group id for this item
    var groupId = this.tree.join("_");

    console.info("groupId:", groupId);

    // NEW - BELOW HERE

    // load the children for this item
    this.loadTree(
      data,
      this.elements.roadmapTreeContainer,
      index !== null ? level + 1 : 0
    );
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var roadmap = new Roadmap();
});
