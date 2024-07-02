import { Chess } from "chess.js/dist/esm/chess.js";
import { Chessboard, FEN } from "cm-chessboard/src/Chessboard.js";
import {
  ChessboardView,
  COLOR,
  INPUT_EVENT_TYPE,
  BORDER_TYPE,
  POINTER_EVENTS,
} from "cm-chessboard/src/view/ChessboardView.js";
import {
  MARKER_TYPE,
  Markers,
} from "cm-chessboard/src/extensions/markers/Markers.js";

import "../styles/repertoire.css";

var Repertoire = {
  board: null,
  game: new Chess(),

  lastMove: "",
  previewMove: "",

  statusField: null,
  fenField: null,
  pgnField: null,

  color: "white",
  saveRepertoireButton: null,
  movesTable: null,

  init: function () {
    // get the status fields
    this.statusField = document.getElementById("statusField");
    this.fenField = document.getElementById("fenField");
    this.pgnField = document.getElementById("pgnField");
    // get the save repertoire button
    this.saveRepertoireButton = document.getElementById("saveRepertoireButton");
    // get the moves table
    this.movesTable = document.getElementById("movesTable");
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
    this.board = new Chessboard(el, {
      position: FEN.start,
      orientation:
        this.color && this.color == "white" ? COLOR.white : COLOR.black,
      assetsUrl: "/build/", // wherever you copied the assets folder to, could also be in the node_modules folder
      style: {
        cssClass: "default", // set the css theme of the board, try "green", "blue" or "chess-club"
        showCoordinates: true, // show ranks and files
        aspectRatio: 1, // height/width of the board
        animationDuration: 300, // pieces animation duration in milliseconds. Disable all animations with `0`
      },
      extensions: [{ class: Markers }],
    });

    // attach the event handler
    this.board.enableMoveInput(this.inputHandler.bind(this));

    // update the status
    this.updateStatus();
  },

  inputHandler: function (event) {
    switch (event.type) {
      case INPUT_EVENT_TYPE.moveInputStarted:
        return this.moveInputStarted(event);
      case INPUT_EVENT_TYPE.validateMoveInput:
        return this.validateMoveInput(event);
      case INPUT_EVENT_TYPE.moveInputCanceled:
        this.moveInputCancelled(event);
        break;
      case INPUT_EVENT_TYPE.moveInputFinished:
        this.moveInputFinished(event);
        break;
      case INPUT_EVENT_TYPE.movingOverSquare:
        break;
    }
  },

  moveInputStarted: function (event) {
    // do not pick up pieces if the game is over
    if (this.game.isGameOver()) return false;

    var piece = this.board.getPiece(event.squareFrom);

    // only pick up pieces for the side to move
    if (
      (this.game.turn() === "w" && piece.search(/^b/) !== -1) ||
      (this.game.turn() === "b" && piece.search(/^w/) !== -1)
    ) {
      return false;
    }

    var moves = [];
    for (const move of this.game.moves({ square: event.squareFrom })) {
      // remove the piece notation and other characters to just get the square
      var t = move
        .replace(/^[RNBKQ]x?/, "")
        .replace("!", "")
        .replace("#", "");

      moves.push({ from: event.squareFrom, to: t });
    }

    // show the legal moves
    this.board.addLegalMovesMarkers(moves);

    return true;
  },

  validateMoveInput: function (event) {
    try {
      // see if the move is legal
      var move = this.game.move({
        from: event.squareFrom,
        to: event.squareTo,
        promotion: "q", // NOTE: always promote to a queen for example simplicity
      });

      // remember the last move made
      this.lastMove = event.squareFrom + event.squareTo;

      this.previewMove = "";

      return true;
    } catch (err) {
      console.log(err);

      return false;
    }
  },

  moveInputCancelled: function (event) {
    // remove the legal move markers
    this.board.removeLegalMovesMarkers();
  },

  moveInputFinished: function (event) {
    console.log("-- moveInputFinished:");
    console.log(event);

    // remove the legal move markers
    this.board.removeLegalMovesMarkers();

    // process the move
    this.afterMakeMove();
  },

  // fetch moves for current position
  getMoves: function () {
    console.log("get moves for new position:");

    // clear the moves table
    this.clearMovesTable();

    var url = "/api/moves";
    var data = {
      color: this.color,
      fen: this.game.fen(),
      pgn: this.game.pgn(),
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
        console.log("Success:", JSON.stringify(response));

        // load the moves table
        this.loadMovesTable(response);

        console.log("before toggle: ");
        console.log(response["saved"]);

        // toggle the save repertoire button
        this.toggleSaveRepertoire(response["saved"] == 1 ? false : true);
      })
      .catch((error) => console.error("Error:", error));
  },

  // toggle the save repertoire button
  toggleSaveRepertoire(enabled) {
    this.saveRepertoireButton.disabled = !enabled;
  },

  // save the current path to your repertoire (color, starting position, move, end position)
  onSaveRepertoire: function () {
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

        // toggle the save repertoire button
        this.toggleSaveRepertoire(false);
      })
      .catch((error) => console.error("Error:", error));
  },

  // clear the moves table
  clearMovesTable: function () {
    this.movesTable.disabled = true;
    this.movesTable.classList.add("opacity-50");
  },

  // load the moves table
  loadMovesTable: function (data) {
    console.log("load moves table:");
    console.log(data);

    // remove all current moves
    while (this.movesTable.tBodies[0].rows.length > 0) {
      this.movesTable.tBodies[0].deleteRow(0);
    }

    this.movesTable.disabled = false;
    this.movesTable.classList.remove("opacity-50");

    // loop through the repertoire moves
    for (var i = 0; i < data.repertoire.length; i++) {
      this.movesAddRow(
        data.repertoire[i].move,
        data.repertoire[i].eco,
        data.repertoire[i].name,
        1
      );
    }

    // loop through the moves
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

    // toggle no moves found text
    if (this.movesTable.tBodies[0].rows.length > 0) {
      this.movesTable.parentNode.firstElementChild.classList.add("hidden");
    } else {
      this.movesTable.parentNode.firstElementChild.classList.remove("hidden");
    }
  },

  // add a row to the moves table
  movesAddRow(move, code, name, repertoire) {
    var row = this.movesTable.tBodies[0].insertRow(-1);
    row.className = "hover:cursor-pointer hover:bg-slate-100";
    row.setAttribute("data-move", move);

    var cell = row.insertCell(-1);
    cell.className = "w-10 px-2 py-2";
    cell.innerHTML = move;

    cell = row.insertCell(-1);
    cell.className = "w-10 px-2 py-2";
    cell.innerHTML = code;

    cell = row.insertCell(-1);
    cell.className = "px-2 py-2";
    cell.innerHTML = name;

    cell = row.insertCell(-1);
    cell.className = "w-12 px-2 py-2 text-center align-middle";
    if (repertoire) {
      cell.innerHTML =
        '<div class="inline-block w-2 h-2 bg-indigo-400 rounded-full"></div>';
      // <div class="inline-block w-2 h-2 bg-indigo-400 rounded-full"></div>
      // <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewbox="0 0 24 24" stroke-width="1.5" stroke="rgb(129,140,248)" class="inline-block size-6"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
    }

    // add event listeners
    row.addEventListener("mouseover", (event) => {
      console.log(event);
      console.log("mouseover:");
      console.log(event.target);
      console.log(event.target.parentNode);

      // make sure we have the div (not one of the child spans)
      var targ =
        event.target.tagName.toLowerCase() == "td"
          ? event.target.parentNode
          : event.target;

      console.log("mouseover: " + targ.dataset.move);

      Repertoire.showPreviewMove(targ.dataset.move);
    });

    row.addEventListener("mouseleave", (event) => {
      console.log(event);
      console.log("mouseleave");

      Repertoire.undoPreviewMove();
    });

    row.addEventListener("click", (event) => {
      // make sure we have the div (not one of the child spans)
      var targ =
        event.target.tagName.toLowerCase() == "td"
          ? event.target.parentNode
          : event.target;

      console.log("onclick: " + targ.dataset.move);

      // only make the move if the table is not disabled (if it is, the moves are being loaded)
      if (!targ.parentNode.parentNode.disabled) {
        Repertoire.makeMove(targ.dataset.move);
      }
    });
  },

  // show the preview move
  showPreviewMove: function (move) {
    if (move != this.previewMove) {
      if (this.previewMove != "") {
        this.game.undo();
      }

      // remember the current preview move
      this.previewMove = move;
      // make the move
      this.game.move(move);
      this.board.setPosition(this.game.fen());
    }
  },

  // undo the preview move
  undoPreviewMove: function () {
    if (this.previewMove != "") {
      this.previewMove = "";

      // undo the preview move
      this.game.undo();
      this.board.setPosition(this.game.fen());
    }
  },

  // make a move
  makeMove: function (move) {
    console.log("make move: " + move + " -- " + this.previewMove);

    // if this move is not the current preview move
    if (move != this.previewMove) {
      // if there was a preview move, undo it
      if (this.previewMove != "") {
        this.game.undo();
      }
      // make the move
      this.game.move(move);
      // set the new position
      this.board.setPosition(this.game.fen());
    }

    // clear the preview move
    this.previewMove = "";

    // process the move
    this.afterMakeMove();
  },

  // called after a move was made
  afterMakeMove: function () {
    // update the status, get the ECO codes for next position.. etc
    this.updateStatus();
  },

  // update the status fields
  updateStatus: function () {
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
    this.fenField.innerHTML = this.game.fen();
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
          sp.className = "inline-block pr-1";
          sp.innerHTML = i / 2 + 1 + ". ";

          this.pgnField.appendChild(sp);
        }
        var sp = document.createElement("span");
        sp.className =
          "inline-block pr-1 rounded" +
          (i + 1 < moves.length
            ? " cursor-pointer hover:text-gray-600 hover:bg-slate-100"
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
  },

  // jump to a certain position
  jumpToMove: function (index) {
    console.log("jumpToMove: " + index);
    console.log(this.game.moveNumber());
    //console.log(this.game.history({ verbose: true }));

    var moves = this.game.history({ verbose: true });

    console.log(moves);
    console.log(moves[index].after);

    // reset the game and make the moves
    this.game.reset();
    for (var i = 0; i <= index; i++) {
      console.log("i: " + i);
      this.game.move(moves[i].san);
    }

    // set the board position
    this.board.setPosition(this.game.fen());

    // update the status, get the ECO codes for next position.. etc
    this.updateStatus();
  },
};

// initialise the Repertoire object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  Repertoire.init();
});
