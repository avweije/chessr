import { MyChessBoard } from "./chessboard.js";
import { COLOR } from "cm-chessboard/src/view/ChessboardView.js";

import "../styles/repertoire.css";

class Repertoire extends MyChessBoard {
  previewMove = "";

  statusField = null;
  pgnField = null;

  color = "white";
  saveRepertoireButton = null;
  movesTable = null;

  repertoireContainer = null;
  repertoireNameInput = null;
  repertoireGroupInput = null;
  repertoireGroupDataList = null;

  constructor() {
    super();
    // get the status fields
    this.statusField = document.getElementById("statusField");
    this.pgnField = document.getElementById("pgnField");
    // get the save repertoire button
    this.saveRepertoireButton = document.getElementById("saveRepertoireButton");
    // get the moves table
    this.movesTable = document.getElementById("movesTable");
    // get the repertoire container and elements
    this.repertoireContainer = document.getElementById("repertoireContainer");
    this.repertoireNameInput = document.getElementById("repertoireNameInput");
    this.repertoireGroupInput = document.getElementById("repertoireGroupInput");
    this.repertoireGroupDataList = document.getElementById(
      "repertoireGroupDataList"
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

    // create the chess board
    this.init(
      el,
      this.color && this.color == "white" ? COLOR.white : COLOR.black
    );

    // enable move input
    this.enableMoveInput();

    // update the status
    this.updateStatus();
  }

  // fetch moves for current position
  getMoves() {
    console.log("get moves for new position:");

    // clear the moves table
    this.clearMovesTable();

    var url = "/api/moves";
    var data = {
      color: this.color,
      fen: this.game.fen(),
      pgn: this.game.pgn(),
      turn: this.game.turn(),
      moveNumber: this.game.moveNumber(),
    };

    fetch(url, {
      method: "POST", // or 'PUT'
      body: JSON.stringify(data), // data can be `string` or {object}!
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log(response);

        // load the moves table
        this.loadMovesTable(response);

        console.log("before toggle: ");
        console.log(response["saved"]);

        // toggle the buttons
        this.toggleButtons(response["saved"]);
      })
      .catch((error) => console.error("Error:", error));
  }

  // toggle the buttons
  toggleButtons(saved) {
    this.toggleSaveRepertoire(!saved);

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
    console.log("saveRepertoire-x:");

    var pgn = "";
    var moves = this.game.history({ verbose: true });
    for (var i = 0; i < moves.length; i++) {
      pgn += " ";
      if (i % 2 == 0) {
        pgn += i / 2 + 1 + ". ";
      }
      pgn += moves[i]["san"];

      moves[i]["pgn"] = pgn;
    }

    console.log("PGN:");
    console.log(pgn);
    console.log(moves);

    // set the data object
    var data = {
      color: this.color,
      moves: moves,
    };

    console.log(data);

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
    console.log("load moves table:");

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

    /*
    // loop through the ECO moves
    for (var i = 0; i < data.eco.next.length; i++) {
      // if in repertoire, skip
      if (data.eco.next[i].repertoire && data.eco.next[i].repertoire == 1)
        continue;

      // get the move from the pgn
      var pgnMove = data.eco.next[i].PGN.split(" ").pop();

      // add the move to the table
      this.movesAddRow(
        pgnMove,
        data.eco.next[i].Code,
        data.eco.next[i].Name,
        0
      );
    }
      */

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
    cell.className = "w-10 px-2 py-2 font-semibold";
    cell.innerHTML = data.move;

    //cell = row.insertCell(-1);
    //cell.className = "w-10 px-2 py-2";
    //cell.innerHTML = data.eco;

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
      flex.className = "flex w-48 overflow-hidden";

      var div1 = document.createElement("div");
      div1.className =
        "bg-slate-100 border rounded-sm border-slate-300 text-xs py-px px-2 text-slate-500 text-center w-[" +
        wpct +
        "%] min-w-min";
      div1.innerHTML = wpct + "%";
      div1.title = "Wins (" + data.wins + ")";

      var div2 = document.createElement("div");
      div2.className =
        "bg-slate-400 border rounded-sm border-slate-500 text-xs mx-px py-px px-2 text-slate-900 text-center w-[" +
        dpct +
        "%] min-w-min";
      div2.innerHTML = dpct + "%";
      div2.title = "Draws (" + data.draws + ")";

      var div3 = document.createElement("div");
      div3.className =
        "bg-slate-800 border rounded-sm border-slate-900 text-xs py-px px-2 text-slate-300 text-center w-[" +
        lpct +
        "%] min-w-min";
      div3.innerHTML = lpct + "%";
      div3.title = "Losses (" + data.losses + ")";

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
        '<div class="inline-block w-3 h-3 bg-indigo-400 rounded-full"></div>';
      // <div class="inline-block w-2 h-2 bg-indigo-400 rounded-full"></div>
      // <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewbox="0 0 24 24" stroke-width="1.5" stroke="rgb(129,140,248)" class="inline-block size-6"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
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
        console.log(err);
        console.log(this.game.pgn());
        console.log(this.game.history({ verbose: true }));

        return false;
      }
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
    console.log("afterMove:");
    console.log(move);

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

    console.log("pgn: " + pgn);

    if (pgn == "") {
      this.pgnField.innerHTML = "--";
    } else {
      var moves = this.game.history({ verbose: true });

      console.log("history moves:");
      console.log(moves);

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
