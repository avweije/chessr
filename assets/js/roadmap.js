import { Utils } from "utils";

/**
 * Controller class for the practice page.
 */
class Roadmap {
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
  }

  // Add event listeners
  addListeners() {
    // Repertoire type selection
    this.elements.roadmapWhite.addEventListener("click", (event) => {
      this.showRoadmapType("white");
    });
    this.elements.roadmapBlack.addEventListener("click", (event) => {
      this.showRoadmapType("black");
    });
    // Open in repertoire/practice links
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
    const inps = Array.from(this.elements.roadmapForm.getElementsByTagName("input"));
    for (let i = 0; i < inps.length; i++) {
      if (inps[i].name == "line[]") {
        this.elements.roadmapForm.removeChild(inps[i]);
      }
    }

    // add the new line[] fields
    for (let i = 0; i < line.line.length; i++) {
      const inp = document.createElement("input");
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

    const url = "/api/roadmap";

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
        Utils.showError(error);
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
    const color = this.getCurrentColor();

    // Reset the tree
    this.tree = tree;

    // get the data
    let data = this.roadmap[color];
    for (let i = 0; i < this.tree.length; i++) {
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
    const color = this.getCurrentColor();
    let data = this.roadmap[color];

    if (this.tree.length > 0) {
      const variation = this.createPathItem(null);
      this.elements.roadmapTreePath.appendChild(variation);
    }

    // add the tree path
    for (let i = 0; i < this.tree.length; i++) {
      data = i == 0 ? data[this.tree[i]] : data.lines[this.tree[i]];
      const variation = this.createPathItem(data, i);
      this.elements.roadmapTreePath.appendChild(variation);
    }
  }

  loadTreeCurrent() {
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
    const color = this.getCurrentColor();

    // get the currently selected data
    let data = this.roadmap[color];
    for (let i = 0; i < this.tree.length; i++) {
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

    //
    let row = document.createElement('div');
    row.className = "grid-header-row";

    // add the header row
    let div = document.createElement("div");
    div.className =
      "is-flex is-justify-content-center is-align-items-center is-rounded is-size-7 p-2";

    let sp = document.createElement("span");
    sp.innerHTML = '<i class="fa-solid fa-medal"></i>';

    div.appendChild(sp);
    row.appendChild(div);

    div = document.createElement("div");
    div.innerHTML = "ECO";
    row.appendChild(div);

    div = document.createElement("div");
    div.innerHTML = "PGN";
    row.appendChild(div);

    div = document.createElement("div");
    div.innerHTML = "Response";
    row.appendChild(div);

    this.elements.roadmapTreeMissingMoves.firstElementChild.appendChild(row);

    // get the missing moves
    const moves = [];
    for (let i = 0; i < missing.length; i++) {
      for (let x = 0; x < missing[i].missing.length; x++) {
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
    for (let i = 0; i < moves.length; i++) {
      //
      row = document.createElement("div");
      row.className = "grid-row";

      // add the percentage played
      div = document.createElement("div");
      div.className = "is-rounded is-size-6 has-text-centered p-3";
      div.innerHTML = moves[i].percentage + "%";
      div.addEventListener(
        "click",
        this.onOpenMissingMove.bind(this, moves[i])
      );

      row.appendChild(div);

      // Create the ECO cell
      div = document.createElement("div");
      div.className = "is-rounded is-size-6 p-3";
      div.innerHTML = moves[i].eco.name;
      div.addEventListener(
        "click",
        this.onOpenMissingMove.bind(this, moves[i])
      );

      row.appendChild(div);

      // Create the PGN cell
      div = document.createElement("div");
      div.className = "is-rounded is-size-6 p-3";
      div.innerHTML = moves[i].pgn;
      div.addEventListener(
        "click",
        this.onOpenMissingMove.bind(this, moves[i])
      );

      row.appendChild(div);

      // Create the move cell
      div = document.createElement("div");
      div.className = "is-rounded is-nowrap p-3";

      let moveSpan = document.createElement('span');
      moveSpan.className = 'is-size-6';
      moveSpan.innerText = moves[i].move;

      let iconSpan = document.createElement('span');
      iconSpan.className = 'grid-show-on-hover icon is-small ml-5 has-text-faded';
      iconSpan.innerHTML = '<i class="fa-solid fa-up-right-from-square"></i>';

      div.appendChild(moveSpan);
      div.appendChild(iconSpan);

      // Add click listener
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

  onOpenMissingMove(move, event) {
    console.info("onOpenMissingMove", move, event);

    this.openIn(move, "./repertoire", true);
  }

  createPathItem(data, index = -1) {
    console.info("createPathItem:", data, index);

    // the accuracy colors
    const colors = [
      ["accuracy-red", "accuracy-red-hover"],
      ["accuracy-orange", "accuracy-orange-hover"],
      ["accuracy-green", "accuracy-green-hover"],
    ];

    const variation = document.createElement("div");
    variation.id = "roadmapTreeItem_" + (data !== null ? data.id : "root");
    variation.className =
      "box is-rounded is-hoverable p-1 m-0 is-relative is-flex is-flex-direction-column is-flex-shrink-0 is-flex-grow-0 is-justify-content-center gap-y-px";
    if (data !== null) {
      variation.setAttribute("data-id", data.id);
      variation.setAttribute("data-level", index);
    }

    const clickable = document.createElement("label");
    clickable.className =
      "is-flex is-justify-content-space-between is-align-items-center is-flex-grow-1 cursor-pointer";

    if (data !== null) {
      const move =
        Math.ceil(data.line.length / 2) +
        "." +
        (data.line.length % 2 == 0 ? ".." : "") +
        " " +
        (data.move !== "" ? data.move : data.line[data.line.length - 1]);

      const pgn = document.createElement("span");
      pgn.className = "has-text-weight-medium whitespace-nowrap px-3 py-2";
      pgn.innerHTML = move;

      const accuracyIdx = Math.max(0, Math.ceil((1 - data.fail) * 3) - 1);

      const accuracy = document.createElement("span");
      accuracy.className =
        "is-flex is-align-items-center has-text-weight-medium is-size-6 px-2 py-2 " +
        colors[accuracyIdx][0];
      //
      const icon = document.createElement("span");
      icon.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
      //
      const percentage = document.createElement("span");
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
      const icon = document.createElement("span");
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
    const colors = [
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

    // Get the group id
    const groupId = this.tree.join("_");
    // Create the tree row
    const row = document.createElement("div");
    row.id = "roadmapTreeRow_" + groupId;
    row.className = "is-flex is-flex-wrap-wrap is-justify-content-center is-gap-2";
    row.setAttribute("data-type", "tree-row");
    row.setAttribute("data-level", level);

    //
    for (let i = 0; i < data.length; i++) {
      console.info(i, data[i]);

      // Create the element for the variation
      const variation = document.createElement("div");
      variation.id = "roadmapTreeItem_" + data[i].id;
      // Set the class
      variation.className =
        "box roadmap-tree-item p-0 m-0 is-relative is-flex is-flex-direction-column is-flex-shrink-0 is-flex-grow-0 is-justify-content-center";
      // Only hoverable if we have follow up lines
      if (data[i].lines.length > 0) variation.className += " is-hoverable";

      // Set the data id & level
      variation.setAttribute("data-id", data[i].id);
      variation.setAttribute("data-level", level);
      
      // Create the hidden radio
      const radio = document.createElement("input");
      radio.id = "roadmapTreeRadio_" + data[i].id;
      radio.name = "roadmapTreeRadio_" + groupId;
      radio.type = "radio";
      radio.className = "is-hidden";

      // Add click handler if we have follow up lines
      if (data[i].lines.length > 0) {
        radio.addEventListener(
          "click",
          this.onClickTreeItem.bind(this, data[i].id, i)
        );
      }
      
      // Add it
      variation.appendChild(radio);

      // Create the label for the radio button
      const clickable = document.createElement("label");
      clickable.htmlFor = "roadmapTreeRadio_" + data[i].id;
      clickable.className = "is-flex is-flex-direction-column is-flex-grow-1 p-3";
      // Add cursor pointer if we have follow up lines
      if (data[i].lines.length > 0) clickable.className += " cursor-pointer";
      
      // Create the header element
      const header = document.createElement("div");
      header.className = "is-flex is-justify-content-space-between is-align-items-center p-1";
      // Get the move as short PGN notation
      const move =
        Math.ceil(data[i].line.length / 2) +
        "." +
        (data[i].line.length % 2 == 0 ? ".." : "") +
        " " +
        (data[i].move !== ""
          ? data[i].move
          : data[i].line[data[i].line.length - 1]);
      // Create the PGN element
      const pgn = document.createElement("span");
      pgn.className = "has-text-weight-medium";
      pgn.innerHTML = move;

      // Get the accuracy index
      let accuracyIdx = Math.min(2, Math.max(0, Math.floor((1 - data[i].fail) * 3)));

      const accuracy = document.createElement("span");
      accuracy.className =
        "is-flex is-align-items-center has-text-weight-medium is-size-6 " +
        colors[accuracyIdx][0];

      const icon = document.createElement("span");
      icon.className = "mr-1";
      icon.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';

      const percentage = document.createElement("span");
      percentage.className = "";
      percentage.innerHTML = Math.round((1 - data[i].fail) * 100) + "%";

      accuracy.appendChild(icon);
      accuracy.appendChild(percentage);

      header.appendChild(pgn);
      header.appendChild(accuracy);

      const main = document.createElement("div");
      main.className = "is-flex is-flex-direction-column is-justify-content-space-between is-flex-grow-1 pt-2";

      const eco = document.createElement("div");
      eco.className = "is-size-6";
      eco.innerHTML =
        data[i].eco && data[i].eco.name ? data[i].eco.name : data[i].pgn;

      const cntrs = document.createElement("div");
      cntrs.className = "is-flex is-justify-content-space-between is-size-7 has-text-faded pt-2";

      // show number of moves in this line
      let sp = document.createElement("span");
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

      // Add the ECO and counters
      main.appendChild(eco);
      main.appendChild(cntrs);

      // Add the header and main part
      clickable.appendChild(header);
      clickable.appendChild(main);

      // Create the footer element
      const footer = document.createElement("div");
      footer.className = "roadmap-tree-item-footer";

      // if there are any variations
      if (data[i].vcount > 0) {
        // find the lowest accuracy in this line
        const lowestAcc = this.findLowestAccuracy(data[i].lines);

        // only show it if it's lower than the current
        if (lowestAcc.fail > data[i].fail) {
          accuracyIdx = Math.max(0, Math.ceil((1 - lowestAcc.fail) * 3) - 1);

          // Create the lowest variation element
          const lowest = document.createElement("span");
          lowest.title = "Lowest accuracy variation";
          lowest.className =
            "cursor-pointer is-flex is-align-items-center px-2 py-1 " +
            colors[accuracyIdx][0] +
            " " +
            colors[accuracyIdx][1];


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
        // Create the last variation in line icon
        const last = document.createElement("span");
        last.title = "Last variation in line";
        last.className = "px-2 py-1";

        sp = document.createElement("span");
        sp.innerHTML = '<i class="fa-solid fa-arrow-turn-down"></i>';

        last.appendChild(sp);

        footer.appendChild(last);
      }

      // Create the missing top responses icon
      const missingMoves = this.findMissingTopPlayedMoves(data[i].lines);
      if (missingMoves.length > 0) {

        let total = 0;
        for (let x = 0; x < missingMoves.length; x++) {
          total += missingMoves[x].missing.length;
        }

        const missing = document.createElement("span");
        missing.title = "Missing top responses";
        missing.className = "link-secondary is-flex is-align-items-center px-2 py-1";

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

      // Create the open in repertoire icon
      const repertoire = document.createElement("span");
      repertoire.title = "Open in repertoire";
      repertoire.className = "link-secondary is-flex is-align-items-center px-2 py-1";
      sp = document.createElement("span");
      sp.innerHTML = '<i class="fa-solid fa-chess-board"></i>';
      repertoire.appendChild(sp);
      repertoire.addEventListener(
        "click",
        this.onOpenInRepertoire.bind(this, data[i])
      );

      // Create the open in practice icon
      const practice = document.createElement("span");
      practice.title = "Open in practice";
      practice.className = "link-secondary is-flex is-align-items-center px-2 py-1";
      sp = document.createElement("span");
      sp.innerHTML = '<i class="fa-solid fa-gamepad"></i>';
      practice.appendChild(sp);
      practice.addEventListener(
        "click",
        this.onOpenInPractice.bind(this, data[i])
      );

      // Add the icons
      footer.appendChild(repertoire);
      footer.appendChild(practice);
      // Add the clickable part and the footer
      variation.appendChild(clickable);
      variation.appendChild(footer);

      row.appendChild(variation);
    }

    // add this row as 1st child (keep the children container as last)
    parent.appendChild(row);
  }

  findLowestAccuracy(lines, highest = 0, tree = []) {
    //
    let highestTree = tree;
    //
    for (let i = 0; i < lines.length; i++) {
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
        const ret = this.findLowestAccuracy(lines[i].lines, highest, [
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

  openIn(line, action = "./repertoire", includeMove = false) {
    // updat the info in the form
    this.elements.roadmapIdInput.value = line.id;
    this.elements.roadmapColorInput.value = this.getCurrentColor();
    this.elements.roadmapPgnInput.value = line.pgn;
    this.elements.roadmapPgnInput.value = "";
    this.elements.roadmapFenInput.value = "";

    console.log(this, this.elements, this.elements.roadmapForm);

    // remove the existing line[] fields
    const inps = Array.from(this.elements.roadmapForm.getElementsByTagName("input"));
    for (let i = 0; i < inps.length; i++) {
      if (inps[i].name == "line[]") {
        this.elements.roadmapForm.removeChild(inps[i]);
      }
    }

    // Get the line moves
    const moves = line.line.slice(0);
    // Add the move if needed
    if (includeMove && line.move) moves.push(line.move);

    // add the new line[] fields
    for (let i = 0; i < moves.length; i++) {
      const inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = "line[]";
      inp.value = moves[i];

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
    let missing = [];
    //
    for (let i = 0; i < lines.length; i++) {
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
      const ret = this.findMissingTopPlayedMoves(lines[i].lines, [...tree, i]);

      missing = [...missing, ...ret];
    }

    return missing;
  }

  onClickTreeItem(id, index, event) {
    console.info("onClickTreeItem", id, index);

    let level = 0;

    // find the item
    if (id !== null) {
      const item = document.getElementById("roadmapTreeItem_" + id);
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
    const color = this.getCurrentColor();

    // get the data
    let data = this.roadmap[color];
    for (let i = 0; i < this.tree.length; i++) {
      data = data[this.tree[i]].lines;
    }

    console.info("data:", data, this.roadmap[color]);

    // get the group id for this item
    const groupId = this.tree.join("_");

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
  const roadmap = new Roadmap();
});
