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
  type = "all";

  practiceRepertoireButtons = null;
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

  analysisGameContainer = null;
  analysisGameFields = null;

  inPractice = false;

  repertoire = [];

  correctMoves = [];

  practiceLines = [];
  practiceLineIdx = 0;
  practiceMoveIdx = 0;
  practiceFailedMove = 0;
  practiceLineColor = "";
  practiceLineMoves = [];
  practiceLineMovesMultiple = [];
  practiceLineMultiple = false;
  practiceLineMovesPlayed = [];
  practiceFenPosition = "";
  practiceAnimateToPostion = true;

  constructor() {
    super();
    // get the practice type buttons
    this.practiceRepertoireButtons = document.getElementById(
      "practiceRepertoireButtons"
    );
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
    // get the analysis game container & fields
    this.analysisGameContainer = document.getElementById(
      "analysisGameContainer"
    );
    this.analysisGameFields = document.getElementById("analysisGameFields");
    // get the board element
    var el = document.getElementById("board");

    // get the practice type
    this.type = el.getAttribute("data-type");

    // attach click handler to the repertoire type buttons
    this.initRepertoireButtons();
    // attach click handler to the start practice button
    this.startPracticeButton.addEventListener(
      "click",
      this.onStartPractice.bind(this)
    );

    // create the chess board
    this.init(el, COLOR.white);

    // disable move input
    this.disableMoveInput();

    // get the entire repertoire
    this.getRepertoire();
  }

  // get the repertoire
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
    // enable the start practice button
    this.startPracticeButton.disabled = false;
    // toggle the repertoire type buttons
    this.toggleRepertoireButtons();

    // get the right repertoire
    var rep =
      this.type == "all"
        ? [...this.repertoire["white"], ...this.repertoire["black"]]
        : this.repertoire[this.type];

    console.log("REP [" + this.type + "]:");
    console.log(rep);

    this.practiceLines = [];

    // get the practice lines
    var moveCount = this.getPracticeLines(rep);

    console.log("practiceLines: " + moveCount);
    console.log(this.practiceLines);

    // show the counters
    this.showCounters(moveCount);
  }

  // add event listeners to the repertoire type buttons
  initRepertoireButtons() {
    this.practiceRepertoireButtons.children[0].addEventListener(
      "click",
      (event) => {
        window.location.href = "/practice/white";
      }
    );
    this.practiceRepertoireButtons.children[1].addEventListener(
      "click",
      (event) => {
        window.location.href = "/practice/black";
      }
    );
    this.practiceRepertoireButtons.children[2].addEventListener(
      "click",
      (event) => {
        window.location.href = "/practice/new";
      }
    );
    this.practiceRepertoireButtons.children[3].addEventListener(
      "click",
      (event) => {
        window.location.href = "/practice/recommended";
      }
    );
    this.practiceRepertoireButtons.children[4].addEventListener(
      "click",
      (event) => {
        window.location.href = "/practice";
      }
    );
    this.practiceRepertoireButtons.children[5].addEventListener(
      "click",
      (event) => {
        window.location.href = "/practice/analysis";
      }
    );
  }

  // toggle the repertoire type buttons
  toggleRepertoireButtons() {
    // toggle the repertoire type buttons
    this.practiceRepertoireButtons.children[0].disabled =
      this.repertoire.white.length == 0;
    this.practiceRepertoireButtons.children[1].disabled =
      this.repertoire.black.length == 0;
    this.practiceRepertoireButtons.children[2].disabled =
      this.repertoire.new.length == 0;
    this.practiceRepertoireButtons.children[3].disabled =
      this.repertoire.recommended.length == 0;
    this.practiceRepertoireButtons.children[4].disabled =
      this.repertoire.white.length == 0 && this.repertoire.black.length == 0;
    this.practiceRepertoireButtons.children[5].disabled =
      this.repertoire.analysis.length == 0;

    // select the right type
    var idx = [
      "white",
      "black",
      "new",
      "recommended",
      "all",
      "analysis",
    ].indexOf(this.type);
    // set to "all" if there are no practice lines for this type
    if (idx == -1 || this.practiceRepertoireButtons.children[idx].disabled) {
      idx = 0;
      this.type = "all";
    }

    // show the current type
    for (var i = 0; i < 6; i++) {
      if (i == idx) {
        this.practiceRepertoireButtons.children[i].classList.remove(
          "text-gray-900"
        );
        this.practiceRepertoireButtons.children[i].classList.remove("bg-white");
        this.practiceRepertoireButtons.children[i].classList.add(
          "text-blue-700"
        );
        this.practiceRepertoireButtons.children[i].classList.add("bg-gray-50");
      } else {
        this.practiceRepertoireButtons.children[i].classList.remove(
          "text-blue-700"
        );
        this.practiceRepertoireButtons.children[i].classList.remove(
          "bg-gray-50"
        );
        this.practiceRepertoireButtons.children[i].classList.add(
          "text-gray-900"
        );
        this.practiceRepertoireButtons.children[i].classList.add("bg-white");
      }
    }
  }

  // save move counters
  saveMoveCounters(moves) {
    console.log("saveMoveCounters:");
    console.log(moves);
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
      } else {
        lineMoves = lines[i].line;
      }

      // is this our move or not
      //var ourMove =
      //(lines[i].color == "white" && depth % 2 == 0) ||
      //(lines[i].color == "black" && depth % 2 == 1);
      var ourMove = depth % 2 == 0;

      // the total moves for this line
      var lineMoveTotal = ourMove
        ? this.type == "analysis"
          ? 1
          : lines[i].moves.length
        : 0;

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
      if (this.type != "analysis" && lines[i].moves.length > 0) {
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
    var [moves, multiple] = this.getMoves();

    console.log("moves:");
    console.log(moves);
    console.log(multiple);

    // if no more moves..
    if (moves.length == 0) {
      // move onto next line..
      this.practiceLineIdx++;
      this.practiceMoveIdx = 0;

      this.practiceAnimateToPostion = true;

      console.log("runPractice-1");

      this.runPractice();

      return;
    }

    this.practiceLineMultiple = moves.length > 1;
    this.practiceLineMoves = moves;
    this.practiceLineMovesMultiple = multiple;
    this.practiceLineMovesPlayed = [];
    this.practiceFailedMove = false;

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

      // if this is an analysis line
      if (this.type == "analysis") {
        // set the starting position for this line
        this.game.reset();
        this.game.load(this.practiceLines[this.practiceLineIdx].fen);
        this.board.setPosition(this.game.fen());
        // update the analysis game fields
        this.analysisGameFields.children[1].innerHTML =
          this.practiceLines[this.practiceLineIdx].color == "white"
            ? this.practiceLines[this.practiceLineIdx].black
            : this.practiceLines[this.practiceLineIdx].white;
        this.analysisGameFields.children[3].innerHTML =
          this.practiceLines[this.practiceLineIdx].move +
          " (" +
          this.practiceLines[this.practiceLineIdx].type +
          ")";
        this.analysisGameFields.children[5].href =
          this.practiceLines[this.practiceLineIdx].link;
        this.analysisGameFields.children[5].innerHTML =
          this.practiceLines[this.practiceLineIdx].link;
      } else if (
        this.practiceLines[this.practiceLineIdx].line.length > 0 ||
        this.practiceLines[this.practiceLineIdx].variation
      ) {
        // if we have moves to make to get to this line
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

    // if this is an analysis line
    if (this.type == "analysis") {
      // make the move that was played (the mistake)
      this.game.move(this.practiceLines[this.practiceLineIdx].move);
      // get the last move
      var last = this.game.history({ verbose: true }).pop();
      // undo the move
      this.game.undo();
      // mark the move that was played
      this.board.addMarker(MARKER_TYPE.square, last.from);
      this.board.addMarker(MARKER_TYPE.square, last.to);
    }

    // if we have multiple moves
    if (moves.length > 1 || multiple.length > 1) {
      // update the status
      if (moves.length < multiple.length) {
        this.showInfo(
          "You have " +
            (multiple.length - moves.length) +
            " more move" +
            (multiple.length - moves.length > 1 ? "s" : "") +
            " in your repertoire here."
        );
      } else {
        // update the status
        if (this.type == "analysis") {
          this.showInfo(
            "You played the move <b>" +
              this.practiceLines[this.practiceLineIdx].move +
              "</b>. Try to find the best " +
              moves.length +
              " moves."
          );
        } else {
          this.showInfo(
            "You have " + moves.length + " moves in your repertoire here."
          );
        }
      }

      // show the played moves container
      this.showPlayedMoves(multiple.length);

      // if we need to add moves to already played moves
      if (moves.length < multiple.length) {
        for (var i = 0; i < multiple.length; i++) {
          if (!moves.includes(multiple[i])) {
            // add the move to the played moves list
            this.setPlayedMove(
              this.practiceLineMovesPlayed.length,
              multiple[i]
            );
            this.practiceLineMovesPlayed.push(multiple[i]);
          }
        }
      }

      // remember the current FEN position
      this.practiceFenPosition = this.game.fen();
    } else {
      // update the status
      if (this.type == "analysis") {
        this.showInfo(
          "You played the move <b>" +
            this.practiceLines[this.practiceLineIdx].move +
            "</b>. Try to find the best move."
        );
      } else {
        this.showInfo("Play the move that's in your repertoire.");
      }

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
    if (this.type != "analysis") {
      for (var i = 0; i < this.practiceMoveIdx; i++) {
        temp = temp.moves[0];
      }
    }

    for (var i = 0; i < temp.moves.length; i++) {
      moves.push(temp.moves[i]["move"]);
    }

    return [moves, temp.multiple];
  }

  afterMove(move) {
    try {
      // get the last move as SAN code
      this.lastMove = this.game.history({ verbose: true }).pop().san;

      // is this the correct repertoire move?
      var isCorrect = this.practiceLineMoves.includes(this.lastMove);

      // if this is the correct move
      if (isCorrect) {
        // highlight the correct move
        this.board.removeMarkers();
        this.board.addMarker(this.markers.checkmark, move.to);

        // handle the next steps
        this.correctMovePlayed();
      } else {
        // update the status
        this.showWarning("That's not the correct move. Try again.");

        // if not already failed
        if (this.practiceFailedMove == 0) {
          // add to the failed counter
          this.addFailedCount();

          // get the current FEN
          var fen = this.getFen();

          // add to the failed count
          var failed = [];

          // if we have multiple moves here
          if (this.practiceLineMultiple) {
            // add only the moves that had not yet been played correctly
            for (var i = 0; i < this.practiceLineMoves.length; i++) {
              if (
                !this.practiceLineMovesPlayed.includes(
                  this.practiceLineMoves[i]
                )
              ) {
                failed.push({
                  fen: fen,
                  move: this.practiceLineMoves[i],
                  failed: 1,
                });
              }
            }
          } else {
            // add the move
            failed.push({
              fen: fen,
              move: this.practiceLineMoves[0],
              failed: 1,
            });
          }

          // save the move counters
          if (failed.length > 0) {
            this.saveMoveCounters(failed);
          }
        } else if (this.practiceLineMultiple) {
          // already failed before - only add to the counter if we have multiple moves that we failed
          if (
            this.practiceFailedMove + this.practiceLineMovesPlayed.length <
            this.practiceLineMoves.length
          ) {
            // add to the failed counter
            this.addFailedCount();
          }
        }

        // remember how many times we failed this move
        this.practiceFailedMove++;

        // highlight the error move
        this.board.removeMarkers();
        this.board.addMarker(this.markers.cancel, move.to);

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
    // if this is an analysis line
    if (this.type == "analysis") {
      // goto the next line
      this.practiceLineIdx++;
      this.practiceMoveIdx = 0;

      this.practiceAnimateToPostion = false;

      this.runPractice();

      return;
    }

    // if we have multiple moves from here or this is an analysis
    if (this.practiceLineMultiple > 1) {
      // goto the next line
      this.practiceLineIdx++;
      this.practiceMoveIdx = 0;
    } else if (next) {
      // goto the next move
      this.practiceMoveIdx++;
    }

    // get the next moves
    var [moves, multiple] = this.getMoves();

    console.log(moves);
    console.log(multiple);

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

    console.log("runPractice-2");

    this.runPractice();

    return;
  }

  // disables the board for a short time and then executes a function
  pauseBoard(func, ms = 800) {
    // disable the board
    this.disableMoveInput();

    setTimeout(() => {
      // enable move input
      this.enableMoveInput();

      // execute the function
      func();
    }, ms);
  }

  // called when the correct move was played
  correctMovePlayed() {
    // if we have multiple correct moves
    if (this.practiceLineMultiple) {
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

      // update the move counter
      this.reduceMoveCount();

      // only add to the correct counter if we haven't failed the move
      if (
        this.practiceFailedMove + this.practiceLineMovesPlayed.length <=
        this.practiceLineMoves.length
      ) {
        this.addCorrectCount();
      }

      // update the counters for this move
      this.saveMoveCounters([
        { fen: this.getFen(), move: this.lastMove, correct: 1 },
      ]);

      // if all correct moves have been played
      if (
        this.practiceLineMovesPlayed.length == this.practiceLineMoves.length
      ) {
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

          console.log("runPractice-3");

          this.runPractice();
        }, 1500);
      } else {
        // update the status
        this.showConfirm("That's correct! Now play the next move.");

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

      // update the move counter
      this.reduceMoveCount();

      // if we have multiples here
      if (this.practiceLineMovesMultiple.length > 1) {
        // show the played move in the list
        this.setPlayedMove(this.practiceLineMovesPlayed.length, this.lastMove);
      }

      // if we didn't fail this move
      if (this.practiceFailedMove == 0) {
        // update the correct counter
        this.addCorrectCount();
      }

      // update the counters for this move
      this.saveMoveCounters([
        { fen: this.getFen(), move: this.practiceLineMoves[0], correct: 1 },
      ]);

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

        console.log("runPractice-4");

        // continue the practice run
        this.runPractice();
      }, 1500);
    }
  }

  // start the practice
  async onStartPractice() {
    console.log("startPractice:");

    // reset vars
    //this.practiceLines = [];
    this.practiceLineIdx = 0;
    this.practiceLineMoveIdx = 0;
    this.practiceLineColor = "";
    this.practiceLineMoves = [];
    this.practiceLineMultiple = false;
    this.practiceLineMovesPlayed = [];
    this.practiceFenPosition = "";

    // disable the start practice button
    this.startPracticeButton.disabled = true;

    // enable board move input
    this.disableMoveInput();
    this.enableMoveInput();

    // show the analysis game container
    if (this.type == "analysis") {
      this.analysisGameContainer.classList.remove("hidden");
    }

    console.log("runPractice-5");

    // run the practice
    this.runPractice();

    return;
  }

  // animate the moves 1 by 1
  async animateMoves(moves) {
    // animate the moves 1 by 1 (except for the last move)
    for (var i = 0; i < moves.length; i++) {
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
        "text-base p-2" + (i + 1 == count ? "" : " border-b border-slate-200");
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
