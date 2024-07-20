import { MyChessBoard } from "./chessboard.js";
import { COLOR } from "cm-chessboard/src/view/ChessboardView.js";
import { Modal } from "./modal.js";

import "../styles/chessboard.css";

class Repertoire extends MyChessBoard {
  previewMove = "";

  statusField = null;
  ecoField = null;
  pgnField = null;

  color = "white";
  saveRepertoireButton = null;
  movesTable = null;

  repertoireContainer = null;
  repertoireGroupInput = null;
  repertoireGroupDataList = null;
  repertoireGroupTagsContainer = null;
  removeRepertoireButton = null;

  repertoire = {
    id: 0,
    container: null,
    groupInput: null,
    groupDataList: null,
    groupTagsContainer: null,
    removeButton: null,
  };

  repertoireId = 0;
  groups = [];
  repertoireGroups = [];

  confirmDialog = {};

  constructor() {
    super();
    // get the status fields
    this.statusField = document.getElementById("statusField");
    this.ecoField = document.getElementById("ecoField");
    this.pgnField = document.getElementById("pgnField");
    // get the save repertoire button
    this.saveRepertoireButton = document.getElementById("saveRepertoireButton");
    // get the moves table
    this.movesTable = document.getElementById("movesTable");
    // get the repertoire container and elements
    this.repertoireContainer = document.getElementById("repertoireContainer");
    this.repertoireGroupInput = document.getElementById("repertoireGroupInput");
    this.repertoireGroupDataList = document.getElementById(
      "repertoireGroupDataList"
    );
    this.repertoireGroupTagsContainer = document.getElementById(
      "repertoireGroupTagsContainer"
    );
    this.removeRepertoireButton = document.getElementById(
      "removeRepertoireButton"
    );

    // get the board element
    var el = document.getElementById("board");
    // get the repertoire color
    this.color = el.getAttribute("data-color");

    // attach click handler to save repertoire button
    this.saveRepertoireButton.addEventListener(
      "click",
      this.onSaveRepertoire.bind(this)
    );

    this.repertoireGroupInput.addEventListener(
      "input",
      this.onRepertoireGroupInput.bind(this)
    );
    this.repertoireGroupInput.addEventListener(
      "keydown",
      this.onRepertoireGroupKeyDown.bind(this)
    );

    this.removeRepertoireButton.addEventListener(
      "click",
      this.onRemoveRepertoireClick.bind(this)
    );

    // create the chess board
    this.init(
      el,
      this.color && this.color == "white" ? COLOR.white : COLOR.black
    );

    // enable move input
    this.enableMoveInput();

    // get the groups
    this.getGroups();

    // update the status
    this.updateStatus();

    // get the modal elements
    this.confirmDialog.modal = document.getElementById("confirmModal");
    this.confirmDialog.closeButton = document.getElementById(
      "confirmModalCloseButton"
    );
    this.confirmDialog.cancelButton = document.getElementById(
      "confirmModalCancelButton"
    );
    this.confirmDialog.confirmButton = document.getElementById(
      "confirmModalConfirmButton"
    );

    // register the modal
    Modal.register(this.confirmDialog.modal, [
      {
        element: this.confirmDialog.closeButton,
        action: "close",
      },
      {
        element: this.confirmDialog.cancelButton,
        action: "close",
      },
      {
        element: this.confirmDialog.confirmButton,
        action: "handler",
        handler: this.onRemoveLineConfirmed.bind(this),
      },
    ]);
  }

  // fired once the remove repertoire button is clicked
  onRemoveRepertoireClick(event) {
    // open the dialog
    Modal.open(this.confirmDialog.modal);
  }

  // fired when the remove repertoire modal has been confirmed
  onRemoveLineConfirmed(event) {
    console.log("Remove the line confirmed.");

    // close the modal
    Modal.close(this.confirmDialog.modal);

    var url = "/api/repertoire";

    var last = this.game.history({ verbose: true }).pop();

    var data = {
      color: this.color,
      fen: this.getFen(),
      move: last.san,
    };

    console.log(data);

    fetch(url, {
      method: "DELETE",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log(response);

        // remove the repertoireId
        this.repertoireId = 0;
        // toggle the buttons
        this.toggleButtons(false);
        // remove the dots for any child moves that have been deleted
        this.movesRemoveDots();
      })
      .catch((error) => console.error("Error:", error));
  }

  // fetch the repertoire groups
  getGroups() {
    var url = "/api/groups";

    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log(response);

        // store the groups
        this.groups = response.groups;
        this.groupsWithEco = response.groups;
        // load the groups table
        this.loadGroups();
      })
      .catch((error) => console.error("Error:", error));
  }

  //
  loadGroups(ecoCode = "") {
    console.log("loadGroups: " + ecoCode);
    //
    while (this.repertoireGroupDataList.firstChild) {
      this.repertoireGroupDataList.removeChild(
        this.repertoireGroupDataList.lastChild
      );
    }

    //
    this.groupsWithEco = this.groups.slice(0);
    var add = true;
    for (var i = 0; i < this.groupsWithEco.length; i++) {
      if (this.groupsWithEco[i].name == ecoCode) {
        add = false;
      }
    }

    if (add) {
      this.groupsWithEco.push({ id: 0, name: ecoCode });
    }

    //
    for (var i = 0; i < this.groupsWithEco.length; i++) {
      var opt = document.createElement("option");
      opt.value = this.groupsWithEco[i].name;
      opt.setAttribute("data-id", this.groupsWithEco[i].id);

      this.repertoireGroupDataList.appendChild(opt);
    }
  }

  // fetch moves for current position
  getMoves() {
    // clear the moves table
    this.clearMovesTable();

    var url = "/api/moves";
    var data = {
      color: this.color,
      //fen: this.game.fen(),
      fen: this.getFen(),
      pgn: this.game.pgn(),
      turn: this.game.turn(),
      moveNumber: this.game.moveNumber(),
    };

    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log(response);

        // handle the response
        this.onGetMoves(response);

        // remember the repertoireId
        this.repertoireId = response["repertoireId"];

        // toggle the buttons
        this.toggleButtons(response["repertoireId"] > 0);
      })
      .catch((error) => console.error("Error:", error));
  }

  // show the moves, the groups
  onGetMoves(data) {
    // set the current ECO code
    this.ecoField.innerHTML =
      data.eco.current && data.eco.current.name ? data.eco.current.name : "";

    console.log("onGetMoves:");
    console.log(data);
    console.log(this.ecoField.innerHTML);

    // reload the groups
    this.loadGroups(this.ecoField.innerHTML);

    // load the moves table
    this.loadMovesTable(data);

    // store the groups for this move
    this.repertoireGroups = data.groups;

    // clear the group tags
    this.clearGroupTags();

    // if this repertoire is saved
    if (data.repertoireId > 0) {
      // add the group tags
      this.addGroupTags();
    }
  }

  // remove the group tags
  clearGroupTags() {
    while (this.repertoireGroupTagsContainer.firstChild) {
      this.repertoireGroupTagsContainer.removeChild(
        this.repertoireGroupTagsContainer.lastChild
      );
    }
  }

  // add the group tags
  addGroupTags() {
    for (var i = 0; i < this.repertoireGroups.length; i++) {
      this.addGroupTag(this.repertoireGroups[i]);
    }
  }

  //
  addGroupTag(group, save = false) {
    // see if the group is already added
    for (
      var i = 0;
      i < this.repertoireGroupTagsContainer.children.length;
      i++
    ) {
      if (
        this.repertoireGroupTagsContainer.children[i].children[0].innerHTML ==
        group.name
      ) {
        return false;
      }
    }

    //
    var el = document.createElement("span");
    el.className =
      "flex items-center mr-1 rounded py-1 px-2 bg-secondary-100 border border-secondary-300";
    el.setAttribute("data-id", group.id);
    el.setAttribute("data-type", "tag");

    var txt = document.createElement("span");
    txt.className = "text-xs mr-2 font-semibold text-secondary-800";
    txt.innerHTML = group.name;

    el.appendChild(txt);

    var btn = document.createElement("button");
    btn.className =
      "flex items-center text-base text-secondary-700 hover:text-secondary-500";
    btn.innerHTML = '<span class="icon-[mdi--delete]"></span>';
    btn.addEventListener("click", this.onRepertoireGroupRemove.bind(this));

    el.appendChild(btn);

    this.repertoireGroupTagsContainer.appendChild(el);

    // if we need to save it
    if (save) {
      // save the repertoire group
      this.saveRepertoireGroup(group);
      // add to the groups array
      var add = true;
      for (var i = 0; i < this.groups.length; i++) {
        if (this.groups[i].name == group.name) {
          add = false;
          break;
        }
      }
      if (add) {
        this.groups.push({ id: 0, name: group.name });
      }
    }

    //repertoireGroupTagsContainer
  }

  // onInput event for the repertoire group input
  onRepertoireGroupInput(event) {
    // if value matches 1 of the groups, presume it was clicked on and add it
    if (this.repertoireGroupInput.value != "") {
      for (var i = 0; i < this.groupsWithEco.length; i++) {
        if (this.repertoireGroupInput.value == this.groupsWithEco[i].name) {
          // add the group
          this.addGroupTag(this.groupsWithEco[i], true);

          this.repertoireGroupInput.value = "";
          break;
        }
      }
    }
  }

  // onKeyDown event for the repertoire group input
  onRepertoireGroupKeyDown(event) {
    // if Enter was pressed and we have a value
    if (event.key === "Enter" && event.target.value.trim() !== "") {
      // check to see if this is an existing group or not
      for (var i = 0; i < this.groupsWithEco.length; i++) {
        if (this.repertoireGroupInput.value == this.groupsWithEco[i].name) {
          // add the group
          this.addGroupTag(this.groupsWithEco[i], true);

          this.repertoireGroupInput.value = "";

          return;
        }
      }

      // add the (new) group tag
      this.addGroupTag({ id: 0, name: this.repertoireGroupInput.value }, true);

      this.repertoireGroupInput.value = "";
    }
  }

  // event when the remove tag button is clicked
  onRepertoireGroupRemove(event) {
    // find the tag
    var tag = event.target.parentNode;
    while (tag.parentNode) {
      if (tag.getAttribute("data-type") === "tag") {
        // get the group name
        var groupName = tag.children[0].innerHTML;
        // remove the tag
        tag.parentNode.removeChild(tag);

        // remove the repertoire group
        this.removeRepertoireGroup(groupName);

        return true;
      }

      tag = tag.parentNode;
    }

    return false;
  }

  // save the repertoire group
  saveRepertoireGroup(group) {
    console.log("saveRepertoireGroup:");

    // set the data object
    var data = {
      repertoire: this.repertoireId,
      group: group.name,
    };

    console.log(data);

    // send the API request
    var url = "/api/repertoire/group";
    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:", JSON.stringify(response));
      })
      .catch((error) => console.error("Error:", error));
  }

  // remove the repertoire group
  removeRepertoireGroup(groupName) {
    console.log("removeRepertoireGroup:");

    // set the data object
    var data = {
      repertoire: this.repertoireId,
      group: groupName,
    };

    console.log(data);

    // send the API request
    var url = "/api/repertoire/group";
    fetch(url, {
      method: "DELETE",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:", JSON.stringify(response));
      })
      .catch((error) => console.error("Error:", error));
  }

  // toggle the buttons
  toggleButtons(saved) {
    console.log("toggleButtons: " + saved);
    console.log(this.color);
    console.log(this.game.turn());
    console.log("moveNumber: " + this.game.moveNumber());

    // make sure we've made a move
    var hasMoved =
      (this.color == "white" &&
        (this.game.moveNumber() > 1 || this.game.turn() == "b")) ||
      (this.color == "black" && this.game.moveNumber() > 1);

    // toggle the save repertoire button
    this.toggleSaveRepertoire(!saved && hasMoved);

    var ourTurn =
      (this.color == "white" && this.game.turn() == "w") ||
      (this.color == "black" && this.game.turn() == "b");

    if (saved && !ourTurn) {
      this.showRepertoireDetails();
    } else {
      this.hideRepertoireDetails();
    }
  }

  // toggle the save repertoire button
  toggleSaveRepertoire(enabled) {
    this.saveRepertoireButton.disabled = !enabled;
  }

  // save the current path to your repertoire (color, starting position, move, end position)
  onSaveRepertoire() {
    var pgn = "";
    var moves = this.historyWithCorrectFen();
    for (var i = 0; i < moves.length; i++) {
      pgn += " ";
      if (i % 2 == 0) {
        pgn += i / 2 + 1 + ". ";
      }
      pgn += moves[i]["san"];

      moves[i]["pgn"] = pgn;
    }

    // set the data object
    var data = {
      color: this.color,
      moves: moves,
    };

    // send the API request
    var url = "/api/repertoire";
    fetch(url, {
      method: "POST", // or 'PUT'
      body: JSON.stringify(data), // data can be `string` or {object}!
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:", JSON.stringify(response));

        // toggle the buttons
        this.toggleButtons(true);
      })
      .catch((error) => console.error("Error:", error));
  }

  // show the repertoire details
  showRepertoireDetails() {
    this.repertoireContainer.classList.remove("hidden");
  }

  // hide the repertoire details
  hideRepertoireDetails() {
    this.repertoireContainer.classList.add("hidden");
  }

  // clear the moves table
  clearMovesTable() {
    this.movesTable.disabled = true;
    this.movesTable.classList.add("opacity-50");
  }

  // load the moves table
  loadMovesTable(data) {
    // remove all current moves
    while (this.movesTable.tBodies[0].rows.length > 0) {
      this.movesTable.tBodies[0].deleteRow(0);
    }

    this.movesTable.disabled = false;
    this.movesTable.classList.remove("opacity-50");

    // add the repertoire moves
    for (var i = 0; i < data.repertoire.length; i++) {
      var params = {
        move: data.repertoire[i].move,
        eco: data.repertoire[i].eco,
        name: data.repertoire[i].name,
        repertoire: 1,
        percentage: 0,
        total: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      };

      // find the move in most played
      for (var y = 0; y < data.games.moves.length; y++) {
        if (data.games.moves[y].move == data.repertoire[i].move) {
          params.percentage = data.games.moves[y].percentage;
          params.total = data.games.moves[y].total;
          params.wins = data.games.moves[y].wins;
          params.draws = data.games.moves[y].draws;
          params.losses = data.games.moves[y].losses;
        }
      }

      this.movesAddRow(params);
    }

    // add the most played moves
    for (var i = 0; i < data.games.moves.length; i++) {
      // if not in our repertoire
      if (data.games.moves[i].repertoire == 0) {
        this.movesAddRow(data.games.moves[i]);
      }
    }

    // toggle no moves found text
    if (this.movesTable.tBodies[0].rows.length > 0) {
      this.movesTable.parentNode.firstElementChild.classList.add("hidden");
    } else {
      this.movesTable.parentNode.firstElementChild.classList.remove("hidden");
    }
  }

  // add a row to the moves table
  movesAddRow(data) {
    var row = this.movesTable.tBodies[0].insertRow(-1);
    row.className = "hover:cursor-pointer hover:bg-slate-100";
    row.setAttribute("data-move", data.move);

    var cell = row.insertCell(-1);
    cell.className = "w-12 pl-3 pr-2 py-2 font-semibold";
    cell.innerHTML = data.move;

    cell = row.insertCell(-1);
    cell.className = "w-full px-2 py-2";
    cell.innerHTML = data.name;

    // show percentage played
    cell = row.insertCell(-1);
    cell.className = "w-10 px-2 py-2 text-xs text-center";
    cell.innerHTML = data.percentage > 0 ? data.percentage + "%" : "";

    // show win/draw/lose %
    cell = row.insertCell(-1);
    cell.className = "px-2 py-1";
    if (data.total > 0) {
      // get the percentages
      var wpct = Math.round((data.wins / data.total) * 100);
      var lpct = Math.round((data.losses / data.total) * 100);
      var dpct = 100 - wpct - lpct;

      var flex = document.createElement("div");
      flex.className =
        "flex min-w-32 w-44 max-w-52 rounded-full border border-slate-300 overflow-hidden";
      flex.title = "Win/draw/loss % for " + this.getNumberOfGames(data.total);

      var div1 = document.createElement("div");
      div1.className =
        "bg-slate-100 text-[10px] py-px px-2 text-slate-500 text-center w-[" +
        wpct +
        "%] min-w-min";
      div1.innerHTML = wpct + "%";

      var div2 = document.createElement("div");
      div2.className =
        "bg-slate-300 text-[10px] py-px px-2 text-slate-900 text-center w-[" +
        dpct +
        "%] min-w-min";
      div2.innerHTML = dpct + "%";

      var div3 = document.createElement("div");
      div3.className =
        "bg-slate-600 text-[10px] py-px px-2 text-slate-300 text-center w-[" +
        lpct +
        "%] min-w-min";
      div3.innerHTML = lpct + "%";

      flex.appendChild(div1);
      flex.appendChild(div2);
      flex.appendChild(div3);

      cell.appendChild(flex);
    }

    // show a dot if in repertoire
    cell = row.insertCell(-1);
    cell.className = "w-8 px-2 py-2 text-center align-middle";
    if (data.repertoire) {
      cell.innerHTML =
        '<div class="inline-block w-3 h-3 bg-primary-400 rounded-full"></div>';
    }

    // add event listeners
    row.addEventListener("mouseover", (event) => {
      // make sure we have the row as target
      var targ = event.target;
      while (targ.parentNode && targ.tagName.toLowerCase() != "tr") {
        targ = targ.parentNode;
      }

      this.showPreviewMove(targ.dataset.move);
    });

    row.addEventListener("mouseleave", (event) => {
      this.undoPreviewMove();
    });

    row.addEventListener("click", (event) => {
      // make sure we have the row as target
      var targ = event.target;
      while (targ.parentNode && targ.tagName.toLowerCase() != "tr") {
        targ = targ.parentNode;
      }

      // only make the move if the table is not disabled (if it is, the moves are being loaded)
      if (!targ.parentNode.parentNode.disabled) {
        this.clickMove(targ.dataset.move);
      }
    });
  }

  // clear the dots (if a move was deleted from the repertoire)
  movesRemoveDots() {
    for (var i = 0; i < this.movesTable.tBodies[0].rows.length; i++) {
      this.movesTable.tBodies[0].rows[i].cells[4].innerHTML = "";
    }
  }

  // show the preview move
  showPreviewMove(move) {
    if (move != this.previewMove) {
      // undo the current preview move
      if (this.previewMove != "") {
        this.previewMove = "";
        this.game.undo();
      }

      try {
        // make the move
        this.game.move(move);

        // remember the current preview move
        this.previewMove = move;

        // update the board
        this.board.setPosition(this.game.fen());

        return true;
      } catch (err) {
        return false;
      }
    }
  }

  // get the number of games as formatted text
  getNumberOfGames(total) {
    if (total < 5000) {
      return total + " games";
    } else if (total < 1000000) {
      return "over " + Math.floor(total / 1000) + "k games";
    } else {
      return Math.round(total / 100000) / 10 + " million games";
    }
  }

  // undo the preview move
  undoPreviewMove() {
    if (this.previewMove != "") {
      this.previewMove = "";

      // undo the preview move
      this.game.undo();
      this.board.setPosition(this.game.fen());
    }
  }

  // make a move from the moves list
  clickMove(move) {
    // if there was a preview move, undo it
    if (this.previewMove != "") {
      this.game.undo();
    }

    // clear the preview move
    this.previewMove = "";

    // make the move
    this.makeMove(move);
  }

  // event handler
  afterMove(move) {
    // update the status, get the ECO codes for next position.. etc
    this.updateStatus();
  }

  // update the status fields
  updateStatus() {
    var status = "";

    var moveColor = "White";
    if (this.game.turn() === "b") {
      moveColor = "Black";
    }

    // checkmate?
    if (this.game.isCheckmate()) {
      status = "Game over, " + moveColor + " is in checkmate.";
    }

    // draw?
    else if (this.game.isDraw()) {
      status = "Game over, drawn position";
    }

    // game still on
    else {
      status = moveColor + " to move";

      // check?
      if (this.game.isCheck()) {
        status += ", " + moveColor + " is in check";
      }
    }

    this.statusField.innerHTML = status;
    this.pgnField.innerHTML = "";

    // get the PGN
    var pgn = this.game.pgn();

    if (pgn == "") {
      this.pgnField.innerHTML = "--";
    } else {
      var moves = this.game.history({ verbose: true });

      for (var i = 0; i < moves.length; i++) {
        if (i % 2 == 0) {
          var sp = document.createElement("span");
          sp.className = "inline-block px-0.5";
          sp.innerHTML = i / 2 + 1 + ".";

          this.pgnField.appendChild(sp);
        }
        var sp = document.createElement("span");
        sp.className =
          "inline-block px-0.5 rounded border border-transparent" +
          (i + 1 < moves.length
            ? " cursor-pointer hover:text-gray-600 hover:bg-slate-100 hover:border hover:border-slate-300"
            : "");
        sp.innerHTML = moves[i]["san"];
        sp.setAttribute("data-move", i);

        // add event listener
        if (i + 1 < moves.length) {
          sp.addEventListener("click", (event) => {
            // jump to a certain move
            this.jumpToMove(event.target.getAttribute("data-move"));
          });
        }

        this.pgnField.appendChild(sp);
      }
    }

    // get the moves for the new position
    this.getMoves();
  }
}

// initialise the Repertoire object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  // instantiate the repertoire class
  var repertoire = new Repertoire();
});
