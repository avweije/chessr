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

var Practice = {
  board: null,
  game: new Chess(),

  lastMove: [],

  statusField: null,
  fenField: null,
  pgnField: null,

  color: "white",
  startPracticeButton: null,

  inPractice: false,

  repertoire: [],

  correctMoves: [],

  practiceLines: [],
  practiceLineIdx: 0,
  practiceMoveIdx: 0,
  practiceLineColor: "",
  practiceLineMoves: [],
  practiceLineMultiple: false,
  practiceLineMovesPlayed: [],
  practiceFenPosition: "",
  practiceAnimateToPostion: true,

  init: function () {
    // get the status fields
    this.statusField = document.getElementById("statusField");
    this.fenField = document.getElementById("fenField");
    this.pgnField = document.getElementById("pgnField");
    // get the save practice button
    this.startPracticeButton = document.getElementById("startPracticeButton");
    // get the board element
    var el = document.getElementById("board");
    // get the practice color
    this.color = el.getAttribute("data-color");

    // attach click handler to start practice button
    this.startPracticeButton.addEventListener(
      "click",
      this.onStartPractice.bind(this)
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

    // disable move input
    this.disableMoveInput();

    // get the entire repertoire
    this.getRepertoire();
  },

  // enable move input for the board
  enableMoveInput: function () {
    this.board.enableMoveInput(this.inputHandler.bind(this));
  },

  // disable move input for the board
  disableMoveInput: function () {
    this.board.disableMoveInput();
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
      this.lastMove = event;

      // add
      //this.board.removeMarkers();
      //this.board.addMarker(MARKER_TYPE.frame, event.squareTo);

      console.log("validateMoveInput:");
      console.log(this.practiceLineMoves);
      console.log(event);

      var last = this.game.history({ verbose: true }).pop();

      console.log(last);

      // is this the correct repertoire move?
      //var isCorrect = this.correctMoves.includes(this.lastMove);
      var isCorrect = this.practiceLineMoves.includes(last.san);

      if (isCorrect) {
        console.log("That's the CORRECT move!!");

        // highlight the correct move
        this.board.removeMarkers();
        this.board.addMarker(MARKER_TYPE.framePrimary, event.squareTo);

        this.board.disableMoveInput();

        setTimeout(() => {
          // remove markers
          this.board.removeMarkers();
          // enable move input
          this.board.enableMoveInput(this.inputHandler.bind(this));

          // continue on to the next practice... ?
          this.correctMovePlayed();
        }, 500);

        // move onto the next practice line
      } else {
        console.log("D'oh! That's not the correct move :(");

        // highlight as error ?
        // timeout pause..
        // undo last move

        // highlight the error move
        this.board.removeMarkers();
        this.board.addMarker(MARKER_TYPE.frameDanger, event.squareTo);

        this.disableMoveInput();

        setTimeout(() => {
          // remove markers
          this.board.removeMarkers();
          // reset position
          this.game.undo();
          this.board.setPosition(this.game.fen());
          // enable move input
          this.enableMoveInput();
        }, 500);

        // try again..
      }

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

  // fetch the user repertoire
  getRepertoire: function () {
    var url = "/api/practice";

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // reset the book moves
        this.testPractice(response);
      })
      .catch((error) => console.error("Error:", error));
  },

  // setup the practice run
  testPractice: function (json) {
    this.repertoire = json;

    // reset the board
    this.game.reset();
    this.board.setPosition(this.game.fen());
  },

  // split the repertoire into practice lines
  getPracticeLines: function (lines, color = "", lineMoves = [], add = true) {
    for (var i = 0; i < lines.length; i++) {
      // add this line
      if (add) {
        //
        if (color != "") {
          lines[i].color = color;
          lines[i].line = lineMoves;
        }

        this.practiceLines.push(lines[i]);
      }
      // if this line has moves that follow
      if (lines[i].moves.length > 0) {
        //
        if (lines[i].color != "") {
          color = lines[i].color;
        }
        //
        var line = lineMoves.slice(0);
        if (lines[i].move) {
          line.push(lines[i].move);
        }
        // get the practice lines
        this.getPracticeLines(
          lines[i].moves,
          color,
          line,
          lines[i].moves.length > 1
        );
      }
    }
  },

  // run the practice
  runPractice: async function () {
    console.log(
      "run practice: " + this.practiceLineIdx + " / " + this.practiceMoveIdx
    );

    //
    if (this.practiceLineIdx >= this.practiceLines.length) {
      console.log("all lines completed!");

      return;
    }

    console.log(this.practiceLines[this.practiceLineIdx]);

    this.practiceLineColor = this.practiceLines[this.practiceLineIdx].color;

    console.log("line color: " + this.practiceLineColor);

    // get the next moves
    var moves = this.getMoves();

    console.log("moves:");
    console.log(moves);

    // if no more moves..
    if (moves.length == 0) {
      // move onto next line..
      this.practiceLineIdx++;
      this.practiceMoveIdx = 0;

      this.practiceAnimateToPostion = true;

      console.log("end of line reached, goto next line (ANIMATE TO TRUE)");

      this.runPractice();

      return;
    }

    this.practiceLineMultiple = moves.length > 1;
    this.practiceLineMoves = moves;
    this.practiceLineMovesPlayed = [];

    console.log("- multiple : " + this.practiceLineMultiple);

    // if this is the 1st move in the line
    if (this.practiceMoveIdx == 0) {
      console.log(
        "animate to starting position of line: " + this.practiceAnimateToPostion
      );

      console.log(this.practiceLines[this.practiceLineIdx]);

      // load the PGN
      //this.game.loadPgn(pgn);

      if (this.practiceLines[this.practiceLineIdx].line.length > 0) {
        if (this.practiceAnimateToPostion) {
          // reset the game & board
          this.game.reset();
          this.board.setPosition(this.game.fen());

          for (
            var i = 0;
            i < this.practiceLines[this.practiceLineIdx].line.length;
            i++
          ) {
            this.game.move(this.practiceLines[this.practiceLineIdx].line[i]);
          }

          // so we can get the moves
          var history = this.game.history({ verbose: true });

          console.log("history moves:");
          console.log(history);

          // disable board move input
          this.disableMoveInput();

          // animate to this position
          await this.animateMoves(history);

          console.log("animate done..");

          // enable board move input
          this.enableMoveInput();
        }
      }

      // highlight last move
      //if (moves.length > 1) {
      //this.board.removeMarkers();
      //this.board.addMarker(MARKER_TYPE.square, moves[moves.length - 2].to);
      //}
    }

    if (moves.length > 1) {
      console.log("multiple correct moves are possible..");

      console.log("remember current fen position");

      this.practiceFenPosition = this.game.fen();
    } else {
      console.log("only 1 correct move here..");
    }

    // wait on the next move
    this.waitOnMove();
  },

  // get the moves for a certain line/move
  getMoves: function () {
    var moves = [];

    console.log(
      "- get moves : " + this.practiceLineIdx + " :: " + this.practiceMoveIdx
    );

    var temp = this.practiceLines[this.practiceLineIdx];
    for (var i = 0; i < this.practiceMoveIdx; i++) {
      temp = temp.moves[0];
    }

    for (var i = 0; i < temp.moves.length; i++) {
      moves.push(temp.moves[i]["move"]);
    }

    return moves;
  },

  // wait on next move (use auto-play if needed)
  waitOnMove: function () {
    console.log("waiting on move..");
    console.log("-- auto-move : " + this.isAutoMove());

    // if we need to auto-move
    if (this.isAutoMove()) {
      // auto-move (for other color)
      this.autoMove();
    }
  },

  // do we need to auto-move?
  isAutoMove: function () {
    return (
      (this.practiceLineColor == "white" && this.game.turn() == "b") ||
      (this.practiceLineColor == "black" && this.game.turn() == "w")
    );
  },

  // auto-move
  autoMove: function () {
    // if we have multiple moves from here
    if (this.practiceLineMultiple > 1) {
      // goto the next line
      this.practiceLineIdx++;
      this.practiceMoveIdx = 0;
    } else {
      // goto the next move
      this.practiceMoveIdx++;
    }

    // get the next moves
    var moves = this.getMoves();

    console.log("moves-:");
    console.log(moves);

    // if any moves to play
    if (moves.length > 0) {
      console.log("auto-moving: " + moves[0]);

      // make the move
      this.game.move(moves[0]);
      // get the last move
      var last = this.game.history({ verbose: true }).pop();

      console.log(last);

      // animate the move
      this.board.movePiece(last.from, last.to, true);

      // if we have multiple moves from here
      if (moves.length > 1) {
        // goto the next line
        this.practiceLineIdx++;
        this.practiceMoveIdx = 0;

        console.log("goto next line: " + this.practiceLineIdx);
      } else {
        // goto the next move
        this.practiceMoveIdx++;

        console.log("goto next move in line: " + this.practiceMoveIdx);
      }

      this.practiceAnimateToPostion = false;
    } else {
      console.log("no moves found??? ANIMATE TO TRUE");

      // goto the next line
      this.practiceLineIdx++;
      this.practiceMoveIdx = 0;

      this.practiceAnimateToPostion = true;
    }

    this.runPractice();

    return;
  },

  // called when the correct move was played
  correctMovePlayed() {
    console.log("correct move was played");

    console.log("-- auto-move : " + this.isAutoMove());
    console.log("multiple = " + this.practiceLineMultiple);

    // if we need to auto-move
    if (this.isAutoMove()) {
      // auto-move (for other color)
      this.autoMove();

      return;
    }

    // if we have multiple correct moves
    if (this.practiceLineMultiple) {
      this.practiceLineMovesPlayed.push("x");

      if (
        this.practiceLineMovesPlayed.length == this.practiceLineMoves.length
      ) {
        console.log("all the possible correct moves have been played");

        // reset board to previous position, start with next line
        console.log("reset board to previous position (ANIMATE TO FALSE");
        console.log(this.practiceFenPosition);

        this.practiceLineIdx++;
        this.practiceMoveIdx = 0;

        this.practiceAnimateToPostion = false;

        this.runPractice();
      } else {
        console.log("play the next correct move..");

        console.log("undo last move to get correct position again");

        // undo ?
        // setPosition ?

        //this.correctMovePlayed();
        // wait on the next move
        this.waitOnMove();
      }
    } else {
      if (this.practiceLines[this.practiceLineIdx].moves.length > 0) {
        console.log("play the next move in the line");

        this.practiceMoveIdx++;

        this.runPractice();
      } else {
        console.log("no more moves in this line, goto next line");

        this.practiceLineIdx++;
        this.practiceMoveIdx = 0;

        this.runPractice();
      }
    }
  },

  // start the practice
  onStartPractice: async function () {
    console.log("startPractice:");

    this.practiceLines = [];
    this.practiceLineIdx = 0;
    this.practiceLineMoveIdx = 0;
    this.practiceLineColor = "";
    this.practiceLineMoves = [];
    this.practiceLineMultiple = false;
    this.practiceLineMovesPlayed = [];
    this.practiceFenPosition = "";

    this.getPracticeLines(this.repertoire["white"]);

    console.log("practiceLines:");
    console.log(this.practiceLines);

    // enable board move input
    this.disableMoveInput();
    this.enableMoveInput();

    this.runPractice();

    return;
  },

  // animate the moves 1 by 1
  animateMoves: async function (moves) {
    console.log("animateMoves:");
    console.log(moves);

    // animate the moves 1 by 1 (except for the last move)
    for (var i = 0; i < moves.length; i++) {
      console.log(moves[i]);

      await this.board.movePiece(moves[i]["from"], moves[i]["to"], true);
    }
  },

  // make a move on the board
  makeMove: function (move) {
    console.log("make move: " + move);

    // make the move
    this.game.move(move);
    // set the new position
    this.board.setPosition(this.game.fen());

    // process the move
    this.afterMakeMove();
  },

  afterMakeMove: function () {
    // update the status, get the ECO codes for next position.. etc
    this.updateStatus();
  },

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
    this.pgnField.innerHTML = this.game.pgn();

    // get the moves for the new position
    //this.getMoves();
  },
};

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  Practice.init();
});