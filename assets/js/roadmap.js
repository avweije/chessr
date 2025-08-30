import { Utils } from "utils";

/**
 * Controller class for the practice page.
 */
class Roadmap {
  roadmapTypeButtons = null;

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
  roadmapTreeMissingMoves = null;
  roadmapTreeContainer = null;

  // the roadmap data
  roadmap = [];

  // keep track of the selected moves per level, so we have the entire tree to walk through
  tree = [];

  constructor() {
    // get the elements
    this.roadmapTypeButtons = document.getElementById("roadmapTypeButtons");

    this.roadmapIntro = document.getElementById("roadmapIntro");
    this.roadmapIntroText = document.getElementById("roadmapIntroText");
    this.roadmapDetails = document.getElementById("roadmapDetails");
    this.roadmapDetailsEco = document.getElementById("roadmapDetailsEco");
    this.roadmapDetailsPgn = document.getElementById("roadmapDetailsPgn");
    this.roadmapDetailsAccuracy = document.getElementById(
      "roadmapDetailsAccuracy"
    );

    this.openInRepertoireLink = document.getElementById("openInRepertoireLink");
    this.openInPracticeLink = document.getElementById("openInPracticeLink");

    this.roadmapTreePath = document.getElementById("roadmapTreePath");
    this.roadmapTreeCurrent = document.getElementById("roadmapTreeCurrent");
    this.roadmapTreeCurrentField = document.getElementById(
      "roadmapTreeCurrentField"
    );
    this.roadmapTreeCurrentButtons = document.getElementById(
      "roadmapTreeCurrentButtons"
    );
    this.roadmapTreeContainer = document.getElementById("roadmapTreeContainer");
    this.roadmapTreeMissingMoves = document.getElementById(
      "roadmapTreeMissingMoves"
    );

    this.roadmapForm.form = document.getElementById("roadmapForm");
    this.roadmapForm.id = document.getElementById("roadmapIdInput");
    this.roadmapForm.color = document.getElementById("roadmapColorInput");
    this.roadmapForm.pgn = document.getElementById("roadmapPgnInput");
    this.roadmapForm.fen = document.getElementById("roadmapFenInput");
    this.roadmapForm.line = document.getElementById("roadmapLineInput");

    // add event listeners
    this.roadmapTypeButtons.children[0].children[0].addEventListener(
      "click",
      (event) => {
        this.showRoadmapType("white");
      }
    );
    this.roadmapTypeButtons.children[1].children[0].addEventListener(
      "click",
      (event) => {
        this.showRoadmapType("black");
      }
    );

    this.openInRepertoireLink.addEventListener("click", () => {
      document.forms["roadmapForm"].action = "./repertoire";
      document.forms["roadmapForm"].submit();
    });
    this.openInPracticeLink.addEventListener("click", () => {
      document.forms["roadmapForm"].action = "./practice";
      document.forms["roadmapForm"].submit();
    });

    // get the roadmap
    this.getRoadmap();
  }

  // get the currently selected color
  getCurrentColor() {
    return this.roadmapTypeButtons.children[0].children[0].checked
      ? "white"
      : "black";
  }

  // toggle white/black
  showRoadmapType(type) {
    // show the roadmap intro
    this.showRoadmapIntro();
    // load the roadmap tree
    this.loadRoadmapTree();
  }

  // show the roadmap intro text
  showRoadmapIntro() {
    this.roadmapIntro.classList.remove("is-hidden");
    this.roadmapDetails.classList.add("is-hidden");
  }

  // show the roadmap details
  showRoadmapDetails(line) {
    // update the info
    this.roadmapDetailsEco.innerHTML = line.eco.name;
    this.roadmapDetailsPgn.innerHTML = line.pgn;
    this.roadmapDetailsAccuracy.innerHTML =
      Math.round((1 - line.fail) * 100) + "%";

    // updat the info in the form
    this.roadmapForm.id.value = line.id;
    this.roadmapForm.color.value = line.color;
    this.roadmapForm.pgn.value = line.pgn;
    this.roadmapForm.fen.value = "";

    // remove the existing line[] fields
    var inps = Array.from(this.roadmapForm.form.getElementsByTagName("input"));
    for (var i = 0; i < inps.length; i++) {
      if (inps[i].name == "line[]") {
        this.roadmapForm.form.removeChild(inps[i]);
      }
    }

    // add the new line[] fields
    for (var i = 0; i < line.line.length; i++) {
      var inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = "line[]";
      inp.value = line.line[i];

      this.roadmapForm.form.appendChild(inp);
    }

    // show the details
    this.roadmapIntro.classList.add("is-hidden");
    this.roadmapDetails.classList.remove("is-hidden");
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

  //
  loadRoadmapTree(tree = []) {
    //
    var color = this.getCurrentColor();
    //
    var con = document.getElementById("roadmapTreeContainer");

    // reset the tree
    this.tree = tree;

    console.info("loadRoadmapTree:", color);

    // get the data
    var data = this.roadmap[color];
    for (var i = 0; i < this.tree.length; i++) {
      data = data[this.tree[i]].lines;
    }

    // hide the missing moves
    this.roadmapTreeMissingMoves.classList.add("is-hidden");

    // load the tree current (ECO, PGN)
    this.loadTreeCurrent();
    // load the tree path
    this.loadTreePath();
    // load the tree
    this.loadTree(data, con);
  }

  //
  loadTreePath() {
    // clear the path container
    while (this.roadmapTreePath.firstChild) {
      this.roadmapTreePath.removeChild(this.roadmapTreePath.lastChild);
    }

    // get the data
    var color = this.getCurrentColor();
    var data = this.roadmap[color];

    console.info("loadTreePath:", this.tree, this.tree.length);

    //
    if (this.tree.length > 0) {
      //
      var variation = this.createPathItem(null);
      //
      this.roadmapTreePath.appendChild(variation);
    }

    // add the tree path
    for (var i = 0; i < this.tree.length; i++) {
      //
      data = i == 0 ? data[this.tree[i]] : data.lines[this.tree[i]];

      console.info("treePath:", i, this.tree[i], data);

      var variation = this.createPathItem(data, i);

      this.roadmapTreePath.appendChild(variation);
    }
  }

  //
  loadTreeCurrent() {
    console.info("loadTreeCurrent:", this.tree, this.tree.length);

    // if we have no tree
    if (this.tree.length == 0) {
      // hide the tree current
      this.roadmapTreeCurrent.classList.add("is-hidden");
      // show the intro text
      this.roadmapIntroText.classList.remove("is-hidden");

      return true;
    }

    // hide the intro text
    this.roadmapIntroText.classList.add("is-hidden");
    // show the tree current
    this.roadmapTreeCurrent.classList.remove("is-hidden");

    // get the color
    var color = this.getCurrentColor();

    // get the currently selected data
    var data = this.roadmap[color];
    for (var i = 0; i < this.tree.length; i++) {
      data = i == 0 ? data[this.tree[i]] : data.lines[this.tree[i]];
    }

    console.info("data:", data);

    // show the current ECO and PGN
    this.roadmapTreeCurrentField.innerHTML = data.eco
      ? data.eco.name +
        ' (<span class="font-normal">' +
        data.pgn +
        "</span>)"
      : data.pgn;

    return;

    // clear the buttons
    while (this.roadmapTreeCurrentButtons.firstChild) {
      this.roadmapTreeCurrentButtons.removeChild(
        roadmapTreeCurrentButtons.lastChild
      );
    }

    // add the buttons
    var sp = document.createElement("span");
    sp.innerHTML = '<i class="fa-solid fa-chess-board"></i>';

    sp.addEventListener("click", this.onOpenInRepertoire.bind(this, data));

    this.roadmapTreeCurrentButtons.appendChild(sp);

    sp = document.createElement("span");
    sp.innerHTML = '<i class="fa-solid fa-gamepad"></i>';

    sp.addEventListener("click", this.onOpenInPractice.bind(this, data));

    this.roadmapTreeCurrentButtons.appendChild(sp);
  }

  // load the missing moves container and show it
  loadMissingMoves(missing, event) {
    console.info("loadMissingMoves", missing, event);
    console.info(
      this.roadmapTreeMissingMoves,
      this.roadmapTreeMissingMoves.firstElementChild
    );

    // clear current rows
    while (this.roadmapTreeMissingMoves.firstElementChild.firstChild) {
      this.roadmapTreeMissingMoves.firstElementChild.removeChild(
        this.roadmapTreeMissingMoves.firstElementChild.lastChild
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

    this.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

    div = document.createElement("div");
    div.className =
      "rounded bg-tacao-100 dark:bg-slate-700 is-size-6 has-text-weight-medium tc-sharp p-2";
    div.innerHTML = "ECO";

    this.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

    div = document.createElement("div");
    div.className =
      "rounded bg-tacao-100 dark:bg-slate-700 is-size-6 has-text-weight-medium tc-sharp p-2";
    div.innerHTML = "PGN";

    this.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

    div = document.createElement("div");
    div.className =
      "rounded bg-tacao-100 dark:bg-slate-700 is-size-6 has-text-weight-medium text-center tc-sharp p-2";
    div.innerHTML = "Response";

    this.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

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
      row.className = "grid-row-hover contents cursor-pointer tc-base";

      // add the percentage played
      div = document.createElement("div");
      div.className = "rounded is-size-6 text-center p-2";
      div.innerHTML = moves[i].percentage + "%";
      div.addEventListener(
        "click",
        this.onOpenMissingMove.bind(this, moves[i])
      );

      row.appendChild(div);
      //this.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

      // add the ECO
      div = document.createElement("div");
      div.className = "rounded is-size-6 p-2";
      div.innerHTML = moves[i].eco.name;
      div.addEventListener(
        "click",
        this.onOpenMissingMove.bind(this, moves[i])
      );

      row.appendChild(div);
      //this.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

      // add the PGN
      div = document.createElement("div");
      div.className = "rounded is-size-6 p-2";
      div.innerHTML = moves[i].pgn;
      div.addEventListener(
        "click",
        this.onOpenMissingMove.bind(this, moves[i])
      );

      row.appendChild(div);
      //this.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

      // add the move
      div = document.createElement("div");
      div.className = "rounded is-size-6 text-center p-2";
      div.innerHTML = moves[i].move;
      div.addEventListener(
        "click",
        this.onOpenMissingMove.bind(this, moves[i])
      );

      row.appendChild(div);
      //this.roadmapTreeMissingMoves.firstElementChild.appendChild(div);

      this.roadmapTreeMissingMoves.firstElementChild.appendChild(row);
    }

    // show the missing moves
    this.roadmapTreeMissingMoves.classList.remove("is-hidden");
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
      "box p-1 m-0 is-relative is-flex is-flex-direction-column is-flex-shrink-0 is-flex-grow-0 is-justify-content-center gap-y-px rounded-lg overflow-hidden border border-tacao-200 dark:border-slate-600 shadow";
    if (data !== null) {
      variation.setAttribute("data-id", data.id);
      variation.setAttribute("data-level", index);
    }
    //
    var clickable = document.createElement("label");
    clickable.className =
      "is-flex is-justify-content-space-between  is-align-items-center is-flex-grow-1 cursor-pointer tc-sharp hover:text-marigold-600 dark:hover:text-marigold-500 bg-tacao-50/50 dark:bg-slate-800 hover:bg-tacao-100 dark:hover:bg-slate-700";
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
    while (this.roadmapTreeContainer.firstChild) {
      this.roadmapTreeContainer.removeChild(
        this.roadmapTreeContainer.lastChild
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
        "box roadmap-tree-item p-2 m-0 is-relative is-flex is-flex-direction-column is-flex-shrink-0 is-flex-grow-0 is-justify-content-center w-56 rounded-lg overflow-hidden border border-tacao-200 dark:border-slate-600 shadow";
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
    this.roadmapForm.id.value = line.id;
    this.roadmapForm.color.value = this.getCurrentColor();
    this.roadmapForm.pgn.value = line.pgn;
    this.roadmapForm.pgn.value = "";
    this.roadmapForm.fen.value = "";

    // remove the existing line[] fields
    var inps = Array.from(this.roadmapForm.form.getElementsByTagName("input"));
    for (var i = 0; i < inps.length; i++) {
      if (inps[i].name == "line[]") {
        this.roadmapForm.form.removeChild(inps[i]);
      }
    }

    // add the new line[] fields
    for (var i = 0; i < line.line.length; i++) {
      var inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = "line[]";
      inp.value = line.line[i];

      this.roadmapForm.form.appendChild(inp);
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
    this.roadmapTreeMissingMoves.classList.add("is-hidden");

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
      this.roadmapTreeContainer,
      index !== null ? level + 1 : 0
    );
  }

  //
  loadRoadmap(roadmap, depth = 0, hidden = false) {
    var colors = [
      "text-white has-background-danger",
      "text-white has-background-warning",
      "text-white has-background-success",
    ];

    //
    var div = document.createElement("div");
    div.className = "is-flex items-start is-justify-content-center";
    // do we need to hide it?
    if (depth >= 3 && hidden == false && roadmap.length > 2) {
      div.className += " is-hidden";

      hidden = true;
    }

    //
    for (var i = 0; i < roadmap.length; i++) {
      //
      var sp = document.createElement("div");
      sp.className =
        "is-flex is-flex-direction-column is-align-items-stretch" +
        (depth > 0 && roadmap.length > 1 && i > 0 && i < roadmap.length - 1
          ? " border-t border-gray-700 dark:border-gray-100"
          : "");

      //
      var moveCon = document.createElement("div");
      moveCon.className = "is-flex is-flex-direction-column is-justify-content-stretch is-align-items-flex-start";

      //
      if (depth > 0 && roadmap.length > 1 && i == 0) {
        //
        var topLine = document.createElement("div");
        topLine.className =
          "is-align-self-flex-end rounded-tl border-l border-t border-gray-700 dark:border-gray-100";
        topLine.style = "width: 50%; height: 16px;";
        //
        moveCon.appendChild(topLine);
      } else if (depth > 0 && roadmap.length > 1 && i == roadmap.length - 1) {
        //
        var topLine = document.createElement("div");
        topLine.className =
          "rounded-tr border-r border-t border-gray-700 dark:border-gray-100";
        topLine.style = "width: 50%; height: 16px;";
        //
        moveCon.appendChild(topLine);
      } else if (depth > 0 && roadmap.length > 1) {
        //
        var topLine = document.createElement("div");
        topLine.className = "border-r border-gray-700 dark:border-gray-100";
        topLine.style = "width: 50%; height: 15px;";
        //
        moveCon.appendChild(topLine);
      }

      // get the accuracy index for the colors
      var accuracyIdx = Math.max(0, Math.ceil((1 - roadmap[i].fail) * 3) - 1);

      var hdr = document.createElement("span");
      hdr.className =
        "is-align-self-center cursor-pointer is-size-6 py-1 px-2 mx-1 whitespace-nowrap rounded border border-gray-700 dark:border-gray-100 " +
        colors[accuracyIdx];
      hdr.title =
        (roadmap[i].eco && roadmap[i].eco.name ? roadmap[i].eco.name : "") +
        " (" +
        Math.round((1 - roadmap[i].fail) * 100) +
        "%)";
      //
      //hdr.innerHTML = roadmap[i].eco.name;
      hdr.innerHTML =
        roadmap[i].move && roadmap[i].move != ""
          ? roadmap[i].move
          : roadmap[i].line[roadmap[i].line.length - 1];
      //
      moveCon.appendChild(hdr);

      hdr.addEventListener(
        "click",
        (function (_this, line) {
          return function () {
            _this.showRoadmapDetails(line);
          };
        })(this, roadmap[i])
      );

      // if this move has lines, add a vertical line in the middle (connector)
      if (roadmap[i].lines.length > 0) {
        //
        var line = document.createElement("div");
        line.style =
          "width: 50%; height: " +
          (roadmap[i].lines.length > 1 ? "8" : "15") +
          "px;";
        line.className = "border-r border-gray-700 dark:border-gray-100";

        moveCon.appendChild(line);

        //
        if (roadmap[i].lines.length > 1) {
          //
          var invisible =
            depth >= 2 && hidden == false && roadmap[i].lines.length > 2;
          var icon = invisible
            ? '<i class="fa-solid fa-eye"></i>'
            : '<i class="fa-solid fa-eye-slash"></i>';
          //
          var toggle = document.createElement("span");
          toggle.className =
            "text-gray-600 dark:text-gray-200 cursor-pointer self-center w-5 h-5 ";
          toggle.style = "margin-top: -4px; margin-bottom: -4px;";
          toggle.title = invisible ? "Show this line" : "Hide this line";
          toggle.innerHTML = icon;
          toggle.setAttribute("data-visible", invisible ? "no" : "yes");

          toggle.addEventListener(
            "click",
            ((toggle) => {
              return function (event) {
                // toggle the container for the child moves
                if (toggle.getAttribute("data-visible") == "yes") {
                  toggle.setAttribute("data-visible", "no");
                  toggle.innerHTML = '<i class="fa-solid fa-eye"></i>'
                  toggle.title = "Show this line";
                  toggle.nextElementSibling.classList.add("is-hidden");
                  toggle.parentNode.nextElementSibling.classList.add("is-hidden");
                } else {
                  toggle.setAttribute("data-visible", "yes");
                  toggle.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
                  toggle.title = "Hide this line";
                  toggle.nextElementSibling.classList.remove("is-hidden");
                  toggle.parentNode.nextElementSibling.classList.remove(
                    "is-hidden"
                  );
                  // scroll into view
                  toggle.parentNode.nextElementSibling.scrollIntoView();
                }
              };
            })(toggle)
          );
          //
          moveCon.appendChild(toggle);

          //
          line = document.createElement("div");
          line.style = "width: 50%; height: 8px;";
          line.className =
            "border-r border-gray-700 dark:border-gray-100" +
            (invisible ? " is-hidden" : "");

          moveCon.appendChild(line);
        }

        sp.appendChild(moveCon);

        var ftr = this.loadRoadmap(roadmap[i].lines, depth + 1, hidden);
        sp.appendChild(ftr);
      } else {
        sp.appendChild(moveCon);
      }

      div.appendChild(sp);
    }

    return div;
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var roadmap = new Roadmap();
});
