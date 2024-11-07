import { Utils } from "./utils.js";
import { Modal } from "./modal.js";

/**
 * Controller class for the practice page.
 */
class Roadmap {
  roadmapTypeButtons = null;

  roadmapIntro = null;
  roadmapDetails = null;
  roadmapDetailsEco = null;
  roadmapDetailsPgn = null;
  roadmapDetailsAccuracy = null;

  roadmapContainerWhite = null;
  roadmapContainerBlack = null;

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
  roadmapTreeCurrentEco = null;
  roadmapTreeCurrentPgn = null;
  roadmapTreeContainer = null;

  // the roadmap data
  roadmap = [];

  // keep track of the selected moves per level, so we have the entire tree to walk through
  tree = [];

  constructor() {
    // get the elements
    this.roadmapTypeButtons = document.getElementById("roadmapTypeButtons");

    this.roadmapIntro = document.getElementById("roadmapIntro");
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
    this.roadmapTreeCurrentEco = document.getElementById(
      "roadmapTreeCurrentEco"
    );
    this.roadmapTreeCurrentPgn = document.getElementById(
      "roadmapTreeCurrentPgn"
    );
    this.roadmapTreeContainer = document.getElementById("roadmapTreeContainer");

    this.roadmapContainerWhite = document.getElementById(
      "roadmapContainerWhite"
    );
    this.roadmapContainerBlack = document.getElementById(
      "roadmapContainerBlack"
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
    if (type == "white") {
      this.roadmapContainerWhite.classList.remove("hidden");
      this.roadmapContainerBlack.classList.add("hidden");
    } else {
      this.roadmapContainerWhite.classList.add("hidden");
      this.roadmapContainerBlack.classList.remove("hidden");
    }
    // show the roadmap intro
    this.showRoadmapIntro();

    //
    this.loadRoadmapTree();
  }

  // show the roadmap intro text
  showRoadmapIntro() {
    this.roadmapIntro.classList.remove("hidden");
    this.roadmapDetails.classList.add("hidden");
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
    this.roadmapIntro.classList.add("hidden");
    this.roadmapDetails.classList.remove("hidden");
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

    // clear the roadmaps
    //this.roadmapContainerWhite.innerHTML = "";
    //this.roadmapContainerBlack.innerHTML = "";

    // load the roadmaps
    //this.roadmapContainerWhite.appendChild(this.loadRoadmap(roadmap["white"]));
    //this.roadmapContainerBlack.appendChild(this.loadRoadmap(roadmap["black"]));
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

    //
    this.loadTreePath();

    //
    this.loadTreeCurrent();

    //
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
      this.roadmapTreeCurrent.classList.add("hidden");

      return true;
    }

    // show the tree current
    this.roadmapTreeCurrent.classList.remove("hidden");

    // get the color
    var color = this.getCurrentColor();

    // get the currently selected data
    var data = this.roadmap[color];
    for (var i = 0; i < this.tree.length; i++) {
      data = i == 0 ? data[this.tree[i]] : data.lines[this.tree[i]];
    }

    console.info("data:", data);

    // show the current ECO and PGN
    this.roadmapTreeCurrentEco.innerHTML = data.eco ? data.eco.name : "Unknown";
    this.roadmapTreeCurrentPgn.innerHTML = data.pgn;
  }

  //
  createPathItem(data, index = -1) {
    console.info("createPathItem:", data, index);

    // the accuracy colors
    var colors = [
      ["text-red-500", "hover:text-red-300"],
      ["text-orange-400", "hover:text-orange-200"],
      ["text-yellow-500", "hover:text-yellow-300"],
      ["text-secondary-500", "hover:text-secondary-300"],
    ];
    //
    var variation = document.createElement("div");
    variation.id = "roadmapTreeItem_" + (data !== null ? data.id : "root");
    variation.className =
      "relative flex flex-col shrink-0 grow-0 justify-center gap-y-px rounded-lg overflow-hidden bg-slate-600 dark:bg-slate-600 border border-slate-600 dark:border-slate-600 shadow";
    if (data !== null) {
      variation.setAttribute("data-id", data.id);
      variation.setAttribute("data-level", index);
    }
    //
    var clickable = document.createElement("label");
    clickable.className =
      "flex justify-between items-center grow cursor-pointer tc-sharp hover:text-marigold-500 dark:hover:text-marigold-500 bg-slate-800 dark:bg-slate-800 hover:bg-slate-700 dark:hover:bg-slate-700";
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
      pgn.className = "font-medium whitespace-nowrap text-base px-3 py-2";
      pgn.innerHTML = move;

      var accuracyIdx = Math.max(0, Math.ceil((1 - data.fail) * 4) - 1);

      //
      var accuracy = document.createElement("span");
      accuracy.className =
        "flex items-center font-medium text-sm px-2 py-2 " +
        colors[accuracyIdx][0];
      //
      var icon = document.createElement("span");
      icon.className = "w-4 h-4 icon-[mdi--bullseye-arrow]";
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
      icon.className = "w-5 h-5 icon-[mdi--home]";
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
      ["text-red-500", "hover:text-red-300"],
      ["text-orange-400", "hover:text-orange-200"],
      ["text-yellow-500", "hover:text-yellow-300"],
      ["text-secondary-500", "hover:text-secondary-300"],
    ];

    // clear the tree container
    while (this.roadmapTreeContainer.firstChild) {
      this.roadmapTreeContainer.removeChild(
        this.roadmapTreeContainer.lastChild
      );
    }

    //
    var groupId = this.tree.join("_");
    //
    var row = document.createElement("div");
    row.id = "roadmapTreeRow_" + groupId;
    row.className = "flex flex-wrap justify-center gap-1";
    row.setAttribute("data-type", "tree-row");
    row.setAttribute("data-level", level);

    //
    for (var i = 0; i < data.length; i++) {
      console.info(data[i]);

      //
      var variation = document.createElement("div");
      variation.id = "roadmapTreeItem_" + data[i].id;
      variation.className =
        "relative flex flex-col shrink-0 grow-0 justify-center gap-y-px w-56 rounded-lg overflow-hidden bg-slate-600 dark:bg-slate-600 border border-slate-600 dark:border-slate-600 shadow";
      variation.setAttribute("data-id", data[i].id);
      variation.setAttribute("data-level", level);
      //
      var radio = document.createElement("input");
      radio.id = "roadmapTreeRadio_" + data[i].id;
      radio.name = "roadmapTreeRadio_" + groupId;
      radio.type = "radio";
      radio.className = "hidden peer";
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
        "flex flex-col grow bg-slate-800 dark:bg-slate-800 tc-sharp hover:bg-slate-700 dark:hover:bg-slate-700 hover:text-marigold-500 dark:hover:text-marigold-500" +
        (data[i].lines.length > 0 ? " cursor-pointer" : "");
      //
      var header = document.createElement("div");
      header.className = "flex justify-between items-center";
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
      pgn.className = "font-medium text-base px-3 pt-2";
      pgn.innerHTML = move;

      var accuracyIdx = Math.max(0, Math.ceil((1 - data[i].fail) * 4) - 1);

      //

      //
      var accuracy = document.createElement("span");
      accuracy.className =
        "flex items-center self-start font-medium text-sm px-2 pt-2 " +
        colors[accuracyIdx][0];
      //
      var icon = document.createElement("span");
      icon.className = "w-4 h-4 icon-[mdi--bullseye-arrow]";
      //
      var percentage = document.createElement("span");
      percentage.className = "";
      percentage.innerHTML = Math.round((1 - data[i].fail) * 100) + "%";
      //
      accuracy.appendChild(icon);
      accuracy.appendChild(percentage);
      //
      header.appendChild(pgn);
      header.appendChild(accuracy);
      //
      var main = document.createElement("div");
      main.className = "flex flex-col justify-between grow px-3 pb-3 pt-1";

      var eco = document.createElement("div");
      eco.className = "text-sm tc-base";
      eco.innerHTML =
        data[i].eco && data[i].eco.name ? data[i].eco.name : data[i].pgn;

      var cntrs = document.createElement("div");
      cntrs.className = "flex justify-between text-xs tc-faded pt-2";

      // show number of moves in this line
      var sp = document.createElement("span");
      sp.innerHTML =
        '<span class="font-medium">' +
        data[i].mcount +
        "</span> move" +
        (data[i].mcount == 1 ? "" : "s");

      cntrs.appendChild(sp);

      // show number of variations in this line
      if (data[i].vcount > 0) {
        sp = document.createElement("span");
        sp.innerHTML =
          '<span class="font-medium">' +
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
        "flex justify-end items-center text-gray-200 dark:text-gray-200 bg-slate-700 dark:bg-slate-700 px-1";

      // if there are any variations
      if (data[i].vcount > 0) {
        // find the lowest accuracy in this line
        var lowestAcc = this.findLowestAccuracy(data[i].lines);

        console.info("lowestAcc", lowestAcc);

        // only show it if it's lower than the current
        if (lowestAcc.fail > data[i].fail) {
          //
          accuracyIdx = Math.max(0, Math.ceil((1 - lowestAcc.fail) * 4) - 1);
          //
          var lowest = document.createElement("span");
          lowest.title = "Lowest accuracy move";
          lowest.className =
            "cursor-pointer flex items-center px-2 py-1 " +
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
          sp.className = "w-5 h-5 icon-[mdi--trending-down]";

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
        last.className = "px-2 py-1 text-slate-500 dark:text-slate-500";

        sp = document.createElement("span");
        sp.className = "w-5 h-5 icon-[mdi--lastpass]";
        // lastpass
        // ray-end

        last.appendChild(sp);

        footer.appendChild(last);
      }

      //
      var missing = this.findMissingTopPlayedMoves(data[i].lines);
      if (missing.length > 0) {
        //
        var total = 0;
        for (var x = 0; x < missing.length; x++) {
          total += missing[x].missing.length;
        }
        //
        var missing = document.createElement("span");
        missing.title = "Missing top played moves";
        missing.className =
          "cursor-pointer flex items-center px-2 py-1 text-sky-600 hover:text-sky-400 dark:text-sky-600 dark:hover:text-sky-400";

        sp = document.createElement("span");
        sp.className = "w-5 h-5 icon-[mdi--feature-highlight]";

        missing.appendChild(sp);

        sp = document.createElement("span");
        sp.className = "px-1 text-sm";
        sp.innerHTML = total;

        missing.appendChild(sp);

        footer.appendChild(missing);
      }

      //
      var repertoire = document.createElement("span");
      repertoire.title = "Open in repertoire";
      repertoire.className =
        "cursor-pointer flex items-center px-2 py-1 text-slate-500 dark:text-slate-500 hover:text-marigold-500 dark:hover:text-marigold-500";

      sp = document.createElement("span");
      sp.className = "w-5 h-5 icon-[mdi--checkerboard]";

      repertoire.appendChild(sp);

      repertoire.addEventListener(
        "click",
        this.onOpenInRepertoire.bind(this, data[i])
      );

      //
      var practice = document.createElement("span");
      practice.title = "Open in practice";
      practice.className =
        "cursor-pointer flex items-center px-2 py-1 text-slate-500 dark:text-slate-500 hover:text-marigold-500 dark:hover:text-marigold-500";

      sp = document.createElement("span");
      sp.className = "w-5 h-5 icon-[mdi--controller]";

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
          move: lines[i].move,
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
      "text-white bg-red-500",
      "text-white bg-orange-400",
      "text-white bg-yellow-500",
      "text-white bg-secondary-500",
    ];

    //
    var div = document.createElement("div");
    div.className = "flex items-start justify-center";
    // do we need to hide it?
    if (depth >= 3 && hidden == false && roadmap.length > 2) {
      div.className += " hidden";

      hidden = true;
    }

    //
    for (var i = 0; i < roadmap.length; i++) {
      //
      var sp = document.createElement("div");
      sp.className =
        "flex flex-col items-stretch" +
        (depth > 0 && roadmap.length > 1 && i > 0 && i < roadmap.length - 1
          ? " border-t border-gray-700 dark:border-gray-100"
          : "");

      //
      var moveCon = document.createElement("div");
      moveCon.className = "flex flex-col justify-stretch items-start";

      //
      if (depth > 0 && roadmap.length > 1 && i == 0) {
        //
        var topLine = document.createElement("div");
        topLine.className =
          "self-end rounded-tl border-l border-t border-gray-700 dark:border-gray-100";
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
      var accuracyIdx = Math.max(0, Math.ceil((1 - roadmap[i].fail) * 4) - 1);

      //
      var hdr = document.createElement("span");
      hdr.className =
        "self-center cursor-pointer text-sm py-1 px-2 mx-1 whitespace-nowrap rounded border border-gray-700 dark:border-gray-100 " +
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
            ? "icon-[mdi--show-outline]"
            : "icon-[mdi--hide-outline]";
          //
          var toggle = document.createElement("span");
          toggle.className =
            "text-gray-600 dark:text-gray-200 cursor-pointer text-base self-center w-5 h-5 " +
            icon;
          toggle.style = "margin-top: -4px; margin-bottom: -4px;";
          toggle.title = invisible ? "Show this line" : "Hide this line";
          toggle.setAttribute("data-visible", invisible ? "no" : "yes");

          toggle.addEventListener(
            "click",
            ((toggle) => {
              return function (event) {
                // toggle the container for the child moves
                if (toggle.getAttribute("data-visible") == "yes") {
                  toggle.setAttribute("data-visible", "no");
                  toggle.classList.remove("icon-[mdi--hide-outline]");
                  toggle.classList.add("icon-[mdi--show-outline]");
                  toggle.title = "Show this line";
                  toggle.nextElementSibling.classList.add("hidden");
                  toggle.parentNode.nextElementSibling.classList.add("hidden");
                } else {
                  toggle.setAttribute("data-visible", "yes");
                  toggle.classList.remove("icon-[mdi--show-outline]");
                  toggle.classList.add("icon-[mdi--hide-outline]");
                  toggle.title = "Hide this line";
                  toggle.nextElementSibling.classList.remove("hidden");
                  toggle.parentNode.nextElementSibling.classList.remove(
                    "hidden"
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
            (invisible ? " hidden" : "");

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
