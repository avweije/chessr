import { MyChessBoard } from "./chessboard.js";
import { COLOR } from "cm-chessboard/src/view/ChessboardView.js";
import {
  MARKER_TYPE,
  Markers,
} from "cm-chessboard/src/extensions/markers/Markers.js";

import "../styles/repertoire.css";

/*

- 
- add functions like nextVariation, nextLine, nextMove, etc ?
- update status text, 1 more, multiple moves
- update board styling, highlight last move? etc..
- 

*/

class Practice extends MyChessBoard {
  statusField = null;

  color = "white";
  startPracticeButton = null;

  inPractice = false;

  repertoire = [];

  correctMoves = [];

  practiceLines = [];
  practiceLineIdx = 0;
  practiceMoveIdx = 0;
  practiceLineColor = "";
  practiceLineMoves = [];
  practiceLineMultiple = false;
  practiceLineMovesPlayed = [];
  practiceFenPosition = "";
  practiceAnimateToPostion = true;

  constructor() {
    super();
    // get the status fields
    this.statusField = document.getElementById("statusField");
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
    this.init(
      el,
      this.color && this.color == "white" ? COLOR.white : COLOR.black
    );

    // disable move input
    this.disableMoveInput();

    // get the entire repertoire
    this.getRepertoire();
  }

  onValidateMove(move) {
    try {
      console.log("onValidateMove:");
      console.log(this.practiceLineMoves);
      console.log(move);

      this.lastMove = this.game.history({ verbose: true }).pop().san;

      console.log("last move: " + this.lastMove);

      // is this the correct repertoire move?
      var isCorrect = this.practiceLineMoves.includes(this.lastMove);

      //
      // check if we already have this move ??
      //

      // if this is the correct move
      if (isCorrect) {
        console.log("That's the CORRECT move!!");

        // highlight the correct move
        this.board.removeMarkers();
        this.board.addMarker(MARKER_TYPE.framePrimary, move.to);

        this.disableMoveInput();

        setTimeout(() => {
          // remove markers
          this.board.removeMarkers();
          // enable move input
          this.enableMoveInput();

          // continue on to the next practice... ?
          this.correctMovePlayed();
        }, 500);

        // move onto the next practice line
      } else {
        console.log("D'oh! That's not the correct move :(");

        // highlight as error ?
        // timeout pause..
        // undo last move

        // update the status
        this.updateStatus("That's not the correct move. Try again.");

        // highlight the error move
        this.board.removeMarkers();
        this.board.addMarker(MARKER_TYPE.frameDanger, move.to);

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
  }

  getRepertoire() {
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
  }

  // setup the practice run
  testPractice(json) {
    this.repertoire = json;

    // reset the board
    this.game.reset();
    this.board.setPosition(this.game.fen());
  }

  // split the repertoire into practice lines
  getPracticeLines(
    lines,
    color = "",
    lineMoves = [],
    add = true,
    isVariation = false
  ) {
    for (var i = 0; i < lines.length; i++) {
      //
      if (color != "") {
        lines[i].color = color;
        lines[i].line = lineMoves;
      }

      // add this line
      if (add) {
        // if this is a variation
        if (isVariation) {
          lines[i].variation = true;
        }
        // add the practice line
        this.practiceLines.push(lines[i]);
      }
      // if this line has moves that follow
      if (lines[i].moves.length > 0) {
        //
        if (lines[i].color != "") {
          color = lines[i].color;
        }

        // add this move to the line moves array
        var line = lineMoves.slice(0);
        if (lines[i].move) {
          line.push(lines[i].move);
        }

        // get the practice lines
        this.getPracticeLines(
          lines[i].moves,
          color,
          line,
          lines[i].moves.length > 1,
          true
        );
      }
    }
  }

  // run the practice
  async runPractice() {
    console.log(
      "run practice: " + this.practiceLineIdx + " / " + this.practiceMoveIdx
    );

    //
    if (this.practiceLineIdx >= this.practiceLines.length) {
      console.log("all lines completed!");

      // update the status
      this.updateStatus("You completed all the lines.");

      return;
    }

    // update the status
    this.updateStatus("");

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

          // if this line is a variation
          if (this.practiceLines[this.practiceLineIdx].variation) {
            // make the 1st move of the variation, that was the point we left off
            this.game.move(this.practiceLines[this.practiceLineIdx].move);
          }

          // so we can get the moves
          var history = this.game.history({ verbose: true });

          console.log("history moves:");
          console.log(history);
          console.log(this.practiceLineIdx, this.practiceMoveIdx);

          // disable board move input
          this.disableMoveInput();

          // animate to this position
          await this.animateMoves(history);

          console.log("animate done..");
          console.log(this.practiceLineIdx, this.practiceMoveIdx);

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

      // update the status
      this.updateStatus("You have " + moves.length + " possible moves here.");

      console.log("remember current fen position");

      this.practiceFenPosition = this.game.fen();
    } else {
      console.log("only 1 correct move here..");
      console.log(moves);

      // update the status
      this.updateStatus("Play the correct move.");
    }

    // wait on the next move
    this.waitOnMove();
  }

  // get the moves for a certain line/move
  getMoves() {
    var moves = [];

    console.log(
      "- get moves : " + this.practiceLineIdx + " :: " + this.practiceMoveIdx
    );
    console.log(this.practiceLines[this.practiceLineIdx]);

    var temp = this.practiceLines[this.practiceLineIdx];
    for (var i = 0; i < this.practiceMoveIdx; i++) {
      temp = temp.moves[0];
    }

    for (var i = 0; i < temp.moves.length; i++) {
      moves.push(temp.moves[i]["move"]);
    }

    return moves;
  }

  // wait on next move (use auto-play if needed)
  waitOnMove() {
    console.log("waiting on move..");
    console.log("-- auto-move : " + this.isAutoMove());

    // if we need to auto-move
    if (this.isAutoMove()) {
      // auto-move (for other color)
      this.autoMove();
    }
  }

  // do we need to auto-move?
  isAutoMove() {
    //console.log(this.practiceLineColor, this.game.turn());
    return (
      (this.practiceLineColor == "white" && this.game.turn() == "b") ||
      (this.practiceLineColor == "black" && this.game.turn() == "w")
    );
  }

  // auto-move
  autoMove(next = false) {
    // if we have multiple moves from here
    if (this.practiceLineMultiple > 1) {
      console.log("** autoMove: multiple moves **");

      // goto the next line
      this.practiceLineIdx++;
      this.practiceMoveIdx = 0;
    } else {
      console.log("** autoMove top single-move :: practiceMoveIdx++");

      // goto the next move
      if (next) {
        this.practiceMoveIdx++;
      }
    }

    // get the next moves
    var moves = this.getMoves();

    console.log("moves-:");
    console.log(moves);

    // if any moves to play
    if (moves.length > 0) {
      console.log("** auto-moving: " + moves[0]);

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

        console.log("** autoMove single-move :: practiceMoveIdx++");

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
  }

  // called when the correct move was played
  correctMovePlayed() {
    console.log("correct move was played");

    console.log("-- auto-move : " + this.isAutoMove());
    console.log("multiple = " + this.practiceLineMultiple);

    // if we have multiple correct moves
    if (this.practiceLineMultiple) {
      console.log("** correctMovePlayed: multiple moves **");
      console.log(this.lastMove);
      console.log(this.practiceLineMoves);

      // if this move was already played
      if (this.practiceLineMovesPlayed.includes(this.lastMove)) {
        // update status
        this.updateStatus(
          "This move was already played, play the next correct move."
        );

        // undo the last move
        this.game.undo();
        this.board.setPosition(this.game.fen());

        return;
      }

      // add the move to the correctly played moves
      this.practiceLineMovesPlayed.push(this.lastMove);

      // if all correct moves have been played
      if (
        this.practiceLineMovesPlayed.length == this.practiceLineMoves.length
      ) {
        console.log("all the possible correct moves have been played");

        // reset board to previous position, start with next line

        this.practiceLineIdx++;
        this.practiceMoveIdx = 0;

        this.practiceAnimateToPostion = true;

        this.runPractice();
      } else {
        console.log("play the next correct move..");

        console.log("undo last move to get correct position again");

        // undo ?
        // setPosition ?

        // undo the last move
        this.game.undo();
        this.board.setPosition(this.game.fen());

        // update the status
        this.updateStatus("Correct! Now play the next move.");

        //this.correctMovePlayed();
        // wait on the next move
        this.waitOnMove();
      }
    } else {
      // if we need to auto-move
      if (this.isAutoMove()) {
        // auto-move (for other color)
        this.autoMove(true);

        return;
      }

      // if we have more moves in this line
      if (this.practiceLines[this.practiceLineIdx].moves.length > 0) {
        console.log("play the next move in the line");

        this.practiceMoveIdx++;

        console.log("** correctMovePlayed - moves left : practiceMoveIdx++");

        this.runPractice();
      } else {
        console.log("no more moves in this line, goto next line");

        this.practiceLineIdx++;
        this.practiceMoveIdx = 0;

        this.runPractice();
      }
    }
  }

  // start the practice
  async onStartPractice() {
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
  }

  // animate the moves 1 by 1
  async animateMoves(moves) {
    console.log("animateMoves:");
    console.log(moves);

    // animate the moves 1 by 1 (except for the last move)
    for (var i = 0; i < moves.length; i++) {
      console.log(moves[i]);

      await this.board.movePiece(moves[i]["from"], moves[i]["to"], true);
    }
  }

  afterMove() {
    // update the status, get the ECO codes for next position.. etc
    this.updateStatus();
  }

  // update the status
  updateStatus(status = "") {
    var moveColor = "White";
    if (this.game.turn() === "b") {
      moveColor = "Black";
    }

    this.statusField.innerHTML = status + "&nbsp;";
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var practice = new Practice();
});
