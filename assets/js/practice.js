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
  color = "white";

  startPracticeButton = null;

  practiceCountersContainer = null;
  practiceMoveCounter = null;
  practiceCorrectCounter = null;
  practiceFailedCounter = null;

  infoContainer = null;
  confirmContainer = null;
  warningContainer = null;

  playedMovesContainer = null;
  playedMovesList = null;

  inPractice = false;

  repertoire = [];

  correctMoves = [];

  practiceLines = [];
  practiceLineIdx = 0;
  practiceMoveIdx = 0;
  practiceFailedMove = false;
  practiceLineColor = "";
  practiceLineMoves = [];
  practiceLineMultiple = false;
  practiceLineMovesPlayed = [];
  practiceFenPosition = "";
  practiceAnimateToPostion = true;

  constructor() {
    super();
    // get the save practice button
    this.startPracticeButton = document.getElementById("startPracticeButton");
    // get the counter elements
    this.practiceCountersContainer = document.getElementById(
      "practiceCountersContainer"
    );
    this.practiceMoveCounter = document.getElementById("practiceMoveCounter");
    this.practiceCorrectCounter = document.getElementById(
      "practiceCorrectCounter"
    );
    this.practiceFailedCounter = document.getElementById(
      "practiceFailedCounter"
    );
    // get the status containers
    this.infoContainer = document.getElementById("infoContainer");
    this.confirmContainer = document.getElementById("confirmContainer");
    this.warningContainer = document.getElementById("warningContainer");
    // get the played moves container & list
    this.playedMovesContainer = document.getElementById("playedMovesContainer");
    this.playedMovesList = document.getElementById("playedMovesList");
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

  afterMove(move) {
    try {
      // get the last move as SAN code
      this.lastMove = this.game.history({ verbose: true }).pop().san;

      console.log("last move: " + this.lastMove);
      console.log(this.game.history({ verbose: true }).pop());

      // is this the correct repertoire move?
      var isCorrect = this.practiceLineMoves.includes(this.lastMove);

      //
      // check if we already have this move ??
      //

      // if this is the correct move
      if (isCorrect) {
        // highlight the correct move
        this.board.removeMarkers();
        this.board.addMarker(MARKER_TYPE.framePrimary, move.to);

        // handle the next steps
        this.correctMovePlayed();

        // move onto the next practice line
      } else {
        // update the status
        this.showWarning("That's not the correct move. Try again.");

        // if not already failed
        if (!this.practiceFailedMove) {
          this.practiceFailedMove = true;

          this.addFailedCount();
        }

        // highlight the error move
        this.board.removeMarkers();
        this.board.addMarker(MARKER_TYPE.frameDanger, move.to);

        // pause the board for a moment
        this.pauseBoard(() => {
          // remove markers
          this.board.removeMarkers();
          // reset position
          this.game.undo();
          this.board.setPosition(this.game.fen());
        });
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

        // enable the practice
        this.onGetRepertoire(response);
      })
      .catch((error) => console.error("Error:", error));
  }

  // enable the practice
  onGetRepertoire(json) {
    this.repertoire = json;
    this.startPracticeButton.disabled = false;
  }

  // split the repertoire into practice lines
  getPracticeLines(
    lines,
    color = "",
    lineMoves = [],
    add = true,
    isVariation = false,
    depth = 0
  ) {
    // keep track of how many moves there are for us
    var ourMoveTotal = 0;

    for (var i = 0; i < lines.length; i++) {
      // if a color is given
      if (color != "") {
        lines[i].color = color;
        lines[i].line = lineMoves;
      }

      // is this our move or not
      var ourMove =
        (lines[i].color == "white" && depth % 2 == 0) ||
        (lines[i].color == "black" && depth % 2 == 1);

      // the total moves for this line
      var lineMoveTotal = ourMove ? lines[i].moves.length : 0;

      // if we need to add this line
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
        // add this move to the line moves array
        var line = lineMoves.slice(0);
        if (lines[i].move) {
          line.push(lines[i].move);
        }

        // get the practice lines
        var sub = this.getPracticeLines(
          lines[i].moves,
          lines[i].color != "" ? lines[i].color : color,
          line,
          lines[i].moves.length > 1,
          true,
          depth + 1
        );

        // if these are not split lines, include the total our moves
        if (lines[i].moves.length == 1) {
          lineMoveTotal += sub;
        } else {
          ourMoveTotal += sub;
        }
      }

      lines[i]["ourMoves"] = lineMoveTotal;

      ourMoveTotal += lineMoveTotal;
    }

    return ourMoveTotal;
  }

  // run the practice
  async runPractice() {
    console.log(
      "run practice: " + this.practiceLineIdx + " / " + this.practiceMoveIdx
    );

    //
    if (this.practiceLineIdx >= this.practiceLines.length) {
      // update the status
      this.showInfo("You completed all the lines in this repertoire.");
      // disable move input
      this.disableMoveInput();

      return;
    }

    // hide the status message
    //this.hideStatus();

    console.log(this.practiceLines[this.practiceLineIdx]);

    // if the line color changed, we need to reset the board
    var colorChanged =
      this.practiceLineColor != this.practiceLines[this.practiceLineIdx].color;

    // get the line color
    this.practiceLineColor = this.practiceLines[this.practiceLineIdx].color;

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
    this.practiceFailedMove = false;

    console.log("- multiple : " + this.practiceLineMultiple);

    // if this is the 1st move in the line
    if (this.practiceMoveIdx == 0) {
      console.log(
        "animate to starting position of line: " + this.practiceAnimateToPostion
      );

      console.log(this.practiceLines[this.practiceLineIdx]);

      // set the orientation of the board
      var orient =
        this.practiceLineColor == "white" ? COLOR.white : COLOR.black;
      if (this.board.getOrientation() != orient) {
        this.board.setOrientation(orient);
      }

      // load the PGN
      //this.game.loadPgn(pgn);

      // if we have moves to make to get to this line
      if (
        this.practiceLines[this.practiceLineIdx].line.length > 0 ||
        this.practiceLines[this.practiceLineIdx].variation
      ) {
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
      } else if (colorChanged) {
        // reset the game & board
        this.game.reset();
        this.board.setPosition(this.game.fen());
      }

      // highlight last move
      //if (moves.length > 1) {
      //this.board.removeMarkers();
      //this.board.addMarker(MARKER_TYPE.square, moves[moves.length - 2].to);
      //}
    }

    if (moves.length > 1) {
      // update the status
      this.showInfo(
        "You have " + moves.length + " moves in your repertoire here."
      );

      // show the played moves container
      this.showPlayedMoves(moves.length);

      // remember the current FEN position
      this.practiceFenPosition = this.game.fen();
    } else {
      console.log("only 1 correct move here..");
      console.log(moves);

      // update the status
      this.showInfo("Play the move that's in your repertoire.");

      // hide the played moves
      this.hidePlayedMoves();
    }

    // wait on the next move
    this.waitOnMove();
  }

  // get the moves for a certain line/move
  getMoves() {
    var moves = [];

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
    // if we need to auto-move
    if (this.isAutoMove()) {
      // auto-move (for other color)
      this.autoMove();
    }
  }

  // do we need to auto-move?
  isAutoMove() {
    return (
      (this.practiceLineColor == "white" && this.game.turn() == "b") ||
      (this.practiceLineColor == "black" && this.game.turn() == "w")
    );
  }

  // auto-move
  autoMove(next = false) {
    // if we have multiple moves from here
    if (this.practiceLineMultiple > 1) {
      // goto the next line
      this.practiceLineIdx++;
      this.practiceMoveIdx = 0;
    } else if (next) {
      // goto the next move
      this.practiceMoveIdx++;
    }

    // get the next moves
    var moves = this.getMoves();

    // if any moves to play
    if (moves.length > 0) {
      // make the move
      this.game.move(moves[0]);
      // get the last move
      var last = this.game.history({ verbose: true }).pop();

      // animate the move
      this.board.movePiece(last.from, last.to, true);

      // if we have multiple moves from here
      if (moves.length > 1) {
        // goto the next line
        this.practiceLineIdx++;
        this.practiceMoveIdx = 0;
      } else {
        // goto the next move
        this.practiceMoveIdx++;
      }

      this.practiceAnimateToPostion = false;
    } else {
      // goto the next line
      this.practiceLineIdx++;
      this.practiceMoveIdx = 0;

      this.practiceAnimateToPostion = true;
    }

    this.runPractice();

    return;
  }

  // disables the board for a short time and then executes a function
  pauseBoard(func, ms = 500) {
    console.log("pause board: " + ms);

    // disable the board
    this.disableMoveInput();

    setTimeout(() => {
      console.log("executing function..");

      // enable move input
      this.enableMoveInput();

      // execute the function
      func();

      console.log("after function, enabling move input..");
    }, ms);
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
        this.showInfo(
          "You already played this move. Play the next move that's in your repertoire."
        );

        // pause the board for a moment
        this.pauseBoard(() => {
          // undo the last move
          this.game.undo();
          this.board.setPosition(this.game.fen());
          // remove markers
          this.board.removeMarkers();
        });

        return;
      }

      // add the move to the correctly played moves
      this.practiceLineMovesPlayed.push(this.lastMove);

      // show the played move in the list
      this.setPlayedMove(
        this.practiceLineMovesPlayed.length - 1,
        this.lastMove
      );

      this.reduceMoveCount();
      this.addCorrectCount();

      // if all correct moves have been played
      if (
        this.practiceLineMovesPlayed.length == this.practiceLineMoves.length
      ) {
        console.log("all the possible correct moves have been played");

        // update the status
        this.showConfirm("That's the correct move!");

        // pause the board for a moment
        this.pauseBoard(() => {
          // hide the played moves list
          this.hidePlayedMoves();
          // remove markers
          this.board.removeMarkers();

          // move onto the next line
          this.practiceLineIdx++;
          this.practiceMoveIdx = 0;

          this.practiceAnimateToPostion = true;

          this.runPractice();
        });
      } else {
        // update the status
        this.showConfirm(
          "That's correct! Now play the next move that's in your repertoire."
        );

        // pause the board for a moment
        this.pauseBoard(() => {
          // undo the last move
          this.game.undo();
          this.board.setPosition(this.game.fen());
          // remove markers
          this.board.removeMarkers();
          // wait on the next move
          this.waitOnMove();
        });
      }
    } else {
      // update the status
      this.showConfirm("That's the correct move!");

      this.reduceMoveCount();
      this.addCorrectCount();

      // if we need to auto-move
      if (this.isAutoMove()) {
        // pause the board for a moment
        this.pauseBoard(() => {
          // remove markers
          this.board.removeMarkers();
          // auto-move (for other color)
          this.autoMove(true);
        });

        return;
      }

      // if we have more moves in this line
      if (this.practiceLines[this.practiceLineIdx].moves.length > 0) {
        // goto the next move
        this.practiceMoveIdx++;
      } else {
        // goto the next line
        this.practiceLineIdx++;
        this.practiceMoveIdx = 0;
      }

      // pause the board for a moment
      this.pauseBoard(() => {
        // remove markers
        this.board.removeMarkers();
        // continue the practice run
        this.runPractice();
      });
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

    // all: white & black
    var rep = [...this.repertoire["white"], ...this.repertoire["black"]];
    //var rep = this.repertoire["black"];

    console.log("REP:");
    console.log(rep);

    // get the practice lines
    var moveCount = this.getPracticeLines(rep);

    console.log("practiceLines: " + moveCount);
    console.log(this.practiceLines);

    // enable board move input
    this.disableMoveInput();
    this.enableMoveInput();

    // show the counters
    this.showCounters(moveCount);

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

  // show the counters
  showCounters(moveCount) {
    this.practiceCountersContainer.classList.remove("hidden");

    this.practiceMoveCounter.innerHTML = moveCount;
    this.practiceCorrectCounter.innerHTML = 0;
    this.practiceFailedCounter.innerHTML = 0;
  }

  // hide the counters
  hideCounters() {
    this.practiceCountersContainer.classList.add("hidden");
  }

  // reduce the move count
  reduceMoveCount() {
    this.practiceMoveCounter.innerHTML =
      parseInt(this.practiceMoveCounter.innerHTML) - 1;
  }

  // add to the correct count
  addCorrectCount() {
    this.practiceCorrectCounter.innerHTML =
      parseInt(this.practiceCorrectCounter.innerHTML) + 1;
  }

  // add to the failed count
  addFailedCount() {
    this.practiceFailedCounter.innerHTML =
      parseInt(this.practiceFailedCounter.innerHTML) + 1;
  }

  // show an info message
  showInfo(status = "") {
    this.confirmContainer.classList.add("hidden");
    this.warningContainer.classList.add("hidden");
    this.infoContainer.classList.remove("hidden");
    this.infoContainer.getElementsByTagName("span")[0].innerHTML = status;
  }

  // show a confirmation message
  showConfirm(status = "") {
    this.infoContainer.classList.add("hidden");
    this.warningContainer.classList.add("hidden");
    this.confirmContainer.classList.remove("hidden");
    this.confirmContainer.getElementsByTagName("span")[0].innerHTML = status;
  }

  // show a warning message
  showWarning(status = "") {
    this.infoContainer.classList.add("hidden");
    this.confirmContainer.classList.add("hidden");
    this.warningContainer.classList.remove("hidden");
    this.warningContainer.getElementsByTagName("span")[0].innerHTML = status;
  }

  // hide the status messages
  hideStatus() {
    this.infoContainer.classList.add("hidden");
    this.confirmContainer.classList.add("hidden");
    this.warningContainer.classList.add("hidden");
  }

  // show the played moves container
  showPlayedMoves(count) {
    console.log("showPlayedMoves: " + count);
    console.log(this.playedMovesList);

    // clear the moves list
    while (this.playedMovesList.lastChild) {
      this.playedMovesList.removeChild(this.playedMovesList.firstChild);
    }

    // get the current move number
    //var moveNr = this.game.moveNumber();

    // add the rows for the moves
    for (var i = 0; i < count; i++) {
      var row = document.createElement("div");
      row.className =
        "text-base p-2" + (i + 1 == count ? " border-b border-slate-200" : "");
      row.innerHTML = this.game.moveNumber() + ". _";

      this.playedMovesList.appendChild(row);
    }

    // show the moves list
    this.playedMovesContainer.classList.remove("hidden");
  }

  // add a move to the played moves container
  setPlayedMove(index, move) {
    console.log(this.playedMovesList);
    console.log(this.playedMovesList.children);

    // set the move
    this.playedMovesList.children[index].innerHTML =
      this.game.moveNumber() + ". " + move;
  }

  // hide the played moves container
  hidePlayedMoves() {
    this.playedMovesContainer.classList.add("hidden");
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var practice = new Practice();
});
