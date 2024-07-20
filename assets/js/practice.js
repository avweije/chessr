import { MyChessBoard } from "./chessboard.js";
import { COLOR } from "cm-chessboard/src/view/ChessboardView.js";
import {
  MARKER_TYPE,
  Markers,
} from "cm-chessboard/src/extensions/markers/Markers.js";
import { Modal } from "./modal.js";

import "../styles/chessboard.css";

/*

- 
- add functions like nextVariation, nextLine, nextMove, etc ?
- update status text, 1 more, multiple moves
- update board styling, highlight last move? etc..
- 

*/

class Practice extends MyChessBoard {
  type = "all";

  buttons = {
    repertoireType: null,
    startPractice: null,
    giveHint: null,
    skipMove: null,
  };

  containers = {
    counters: null,
    moveCounter: null,
    correctCounter: null,
    failedCounter: null,

    info: null,
    confirm: null,
    warning: null,
  };

  playedMovesContainer = null;
  playedMovesList = null;

  inPractice = false;

  repertoire = [];

  correctMoves = [];

  practice = {
    lines: [],
    moveCount: 0,
    lineIdx: 0,
    moveIdx: 0,
    failedCount: 0,
    lineColor: "",
    lineMoves: [],
    lineMovesMultiple: [],
    isMultiple: false,
    lineMovesPlayed: [],
    fenPosition: "",
    animateToPosition: true,
  };

  hintCounter = 0;

  analysis = {
    container: null,
    fields: null,
    saveButton: null,
    ignoreButton: null,
    discardButton: null,
    saveDialog: null,
    ignoreDialog: {},
  };

  constructor() {
    super();

    // get the board element
    var el = document.getElementById("board");
    // get the practice type
    this.type = el.getAttribute("data-type");

    // get the practice type buttons
    this.buttons.repertoireType = document.getElementById(
      "practiceRepertoireButtons"
    );

    // get the save practice button
    this.buttons.startPractice = document.getElementById("startPracticeButton");
    this.buttons.giveHint = document.getElementById("giveHintButton");
    this.buttons.skipMove = document.getElementById("skipMoveButton");

    // get the counter elements
    this.containers.counters = document.getElementById(
      "practiceCountersContainer"
    );
    this.containers.moveCounter = document.getElementById(
      "practiceMoveCounter"
    );
    this.containers.correctCounter = document.getElementById(
      "practiceCorrectCounter"
    );
    this.containers.failedCounter = document.getElementById(
      "practiceFailedCounter"
    );
    // get the status containers
    this.containers.info = document.getElementById("infoContainer");
    this.containers.confirm = document.getElementById("confirmContainer");
    this.containers.warning = document.getElementById("warningContainer");
    // get the played moves container & list
    this.playedMovesContainer = document.getElementById("playedMovesContainer");
    this.playedMovesList = document.getElementById("playedMovesList");

    // attach click handler to the repertoire type buttons
    this.initRepertoireButtons();

    // attach click handler to the start practice button
    this.buttons.startPractice.addEventListener(
      "click",
      this.onStartPractice.bind(this)
    );
    this.buttons.giveHint.addEventListener("click", this.giveHint.bind(this));
    this.buttons.skipMove.addEventListener("click", this.skipMove.bind(this));

    // create the chess board
    this.init(el, COLOR.white);

    // disable move input
    this.disableMoveInput();

    // get the entire repertoire
    this.getRepertoire();

    // if this are ethe analysis lines
    if (this.type == "analysis") {
      // get the elements
      this.analysis.container = document.getElementById(
        "analysisGameContainer"
      );
      this.analysis.fields = document.getElementById("analysisGameFields");
      this.analysis.saveButton = document.getElementById("analysisSaveButton");
      this.analysis.ignoreButton = document.getElementById(
        "analysisIgnoreButton"
      );
      this.analysis.discardButton = document.getElementById(
        "analysisDiscardButton"
      );

      // get the modal elements
      this.analysis.ignoreDialog.modal = document.getElementById("ignoreModal");
      this.analysis.ignoreDialog.closeButton = document.getElementById(
        "ignoreModalCloseButton"
      );
      this.analysis.ignoreDialog.cancelButton = document.getElementById(
        "ignoreModalCancelButton"
      );
      this.analysis.ignoreDialog.confirmButton = document.getElementById(
        "ignoreModalConfirmButton"
      );

      // add the event listeners
      this.analysis.saveButton.addEventListener(
        "click",
        this.onAnalysisSave.bind(this)
      );
      this.analysis.ignoreButton.addEventListener(
        "click",
        this.onAnalysisIgnore.bind(this)
      );
      this.analysis.discardButton.addEventListener(
        "click",
        this.onAnalysisDiscard.bind(this)
      );

      // register the modal
      Modal.register(this.analysis.ignoreDialog.modal, [
        {
          element: this.analysis.ignoreDialog.closeButton,
          action: "close",
        },
        {
          element: this.analysis.ignoreDialog.cancelButton,
          action: "close",
        },
        {
          element: this.analysis.ignoreDialog.confirmButton,
          action: "handler",
          handler: this.onAnalysisIgnoreConfirmed.bind(this),
        },
      ]);
    }
  }

  // fired when the analysis save to repertoire button is clicked
  onAnalysisSave(event) {
    console.log("onAnalysisSave:");
  }

  // fired when the analysis ignore button is clicked
  onAnalysisIgnore(event) {
    console.log("onAnalysisIgnore:");

    // show the modal
    Modal.open(this.analysis.ignoreDialog.modal);
  }

  // fired when the analysis discard button is clicked
  onAnalysisDiscard(event, removeFromDb = true) {
    console.log("onAnalysisDiscard:");
    console.log(this.practice.lines[this.practice.lineIdx]);
    console.log(this.practice);

    // reduce by number of moves counter
    var reduceBy = 0;
    for (var i = 0; i < this.practice.lines.length; i++) {
      // if this is the same move
      if (
        this.practice.lines[i].fen ==
          this.practice.lines[this.practice.lineIdx].fen &&
        this.practice.lines[i].move ==
          this.practice.lines[this.practice.lineIdx].move
      ) {
        // increase the reduce by counter by the number of moves we're skipping
        reduceBy =
          reduceBy +
          (i == this.practice.lineIdx
            ? this.practice.lineMoves.length -
              this.practice.lineMovesPlayed.length
            : this.practice.lines[i].lineMoves.length);

        // remove this line
        this.practice.lines.splice(i, 1);
        // adjust the current line index if this line comes before it
        if (i < this.practice.lineIdx) {
          this.practice.lineIdx = this.practice.lineIdx - 1;
        }
      }
    }

    // update the move counter
    if (reduceBy > 0) {
      this.practice.moveCount = this.practice.moveCount - reduceBy;
      this.reduceMoveCount(reduceBy);
    } else {
      // proceed to the next line
      this.practice.lineIdx++;
      this.practice.moveIdx = 0;
    }

    // if we need to remove this move from the database
    if (removeFromDb) {
      //
      // call the api to remove this move (check for multiple based on fen/move in the api)
      //
    }

    // run the next practice
    this.practice.animateToPosition = true;

    this.runPractice();
  }

  // fired when the ignore dialog is confirmed
  onAnalysisIgnoreConfirmed() {
    console.log("onAnalysisIgnoreConfirmed:");

    //
    // call api to add to ignore list (and delete the move)
    //

    // remove from the current practice lines
    this.onAnalysisDiscard(null, false);

    // close the modal
    Modal.close(this.analysis.ignoreDialog.modal);
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
    this.buttons.startPractice.disabled = false;
    // toggle the repertoire type buttons
    this.toggleRepertoireButtons();

    // get the right repertoire
    var rep =
      this.type == "all"
        ? [...this.repertoire["white"], ...this.repertoire["black"]]
        : this.repertoire[this.type];

    console.log("REP [" + this.type + "]:");
    console.log(rep);

    this.practice.lines = [];

    // get the practice lines
    this.practice.moveCount = this.getPracticeLines(rep);

    console.log("practiceLines: " + this.practice.moveCount);
    console.log(this.practice.lines);

    // show the counters
    this.showCounters(this.practice.moveCount);
  }

  // add event listeners to the repertoire type buttons
  initRepertoireButtons() {
    this.buttons.repertoireType.children[0].addEventListener(
      "click",
      (event) => {
        window.location.href = "/practice/white";
      }
    );
    this.buttons.repertoireType.children[1].addEventListener(
      "click",
      (event) => {
        window.location.href = "/practice/black";
      }
    );
    this.buttons.repertoireType.children[2].addEventListener(
      "click",
      (event) => {
        window.location.href = "/practice/new";
      }
    );
    this.buttons.repertoireType.children[3].addEventListener(
      "click",
      (event) => {
        window.location.href = "/practice/recommended";
      }
    );
    this.buttons.repertoireType.children[4].addEventListener(
      "click",
      (event) => {
        window.location.href = "/practice";
      }
    );
    this.buttons.repertoireType.children[5].addEventListener(
      "click",
      (event) => {
        window.location.href = "/practice/analysis";
      }
    );
  }

  // toggle the repertoire type buttons
  toggleRepertoireButtons() {
    // toggle the repertoire type buttons
    this.buttons.repertoireType.children[0].disabled =
      this.repertoire.white.length == 0;
    this.buttons.repertoireType.children[1].disabled =
      this.repertoire.black.length == 0;
    this.buttons.repertoireType.children[2].disabled =
      this.repertoire.new.length == 0;
    this.buttons.repertoireType.children[3].disabled =
      this.repertoire.recommended.length == 0;
    this.buttons.repertoireType.children[4].disabled =
      this.repertoire.white.length == 0 && this.repertoire.black.length == 0;
    this.buttons.repertoireType.children[5].disabled =
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
    if (idx == -1 || this.buttons.repertoireType.children[idx].disabled) {
      idx = 0;
      this.type = "all";
    }

    // show the current type
    for (var i = 0; i < 6; i++) {
      if (i == idx) {
        this.buttons.repertoireType.children[i].classList.remove(
          "text-gray-900"
        );
        this.buttons.repertoireType.children[i].classList.remove("bg-white");
        this.buttons.repertoireType.children[i].classList.add(
          "text-primary-700"
        );
        this.buttons.repertoireType.children[i].classList.add("bg-gray-50");
      } else {
        this.buttons.repertoireType.children[i].classList.remove(
          "text-primary-700"
        );
        this.buttons.repertoireType.children[i].classList.remove("bg-gray-50");
        this.buttons.repertoireType.children[i].classList.add("text-gray-900");
        this.buttons.repertoireType.children[i].classList.add("bg-white");
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
      //var lineMoveTotal = ourMove ? this.type == "analysis" ? 1 : lines[i].moves.length : 0;
      var lineMoveTotal = ourMove ? lines[i].moves.length : 0;

      // if we need to add this line
      if (add) {
        // if this is a variation
        if (isVariation) {
          lines[i].variation = true;
        }
        // add the practice line
        this.practice.lines.push(lines[i]);
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
      "run practice: " + this.practice.lineIdx + " / " + this.practice.moveIdx
    );

    //
    if (this.practice.lineIdx >= this.practice.lines.length) {
      // update the status
      this.showInfo("You completed all the lines in this repertoire.");
      // disable move input
      this.disableMoveInput();

      // toggle the buttons
      this.buttons.startPractice.disabled = false;
      this.buttons.startPractice.classList.remove("hidden");
      this.buttons.startPractice.innerHTML = "Start again";
      this.buttons.giveHint.disabled = true;
      this.buttons.giveHint.classList.add("hidden");
      this.buttons.skipMove.disabled = true;
      this.buttons.skipMove.classList.add("hidden");

      return;
    }

    // hide the status message
    //this.hideStatus();

    console.log(this.practice.lines[this.practice.lineIdx]);

    // if the line color changed, we need to reset the board
    var colorChanged =
      this.practice.lineColor !=
      this.practice.lines[this.practice.lineIdx].color;

    // get the line color
    this.practice.lineColor = this.practice.lines[this.practice.lineIdx].color;

    // get the next moves
    var [moves, multiple] = this.getMoves();

    console.log("moves:");
    console.log(moves);
    console.log(multiple);

    // if no more moves or next move for analysis line..
    if (
      moves.length == 0 ||
      (this.type == "analysis" && this.practice.moveIdx > 0)
    ) {
      // move onto next line..
      this.practice.lineIdx++;
      this.practice.moveIdx = 0;

      this.practice.animateToPosition = true;

      console.log("runPractice-1");

      this.runPractice();

      return;
    }

    // set the practice line vars
    this.practice.isMultiple = moves.length > 1;
    this.practice.lineMoves = moves;
    this.practice.lineMovesMultiple = multiple;
    this.practice.lineMovesPlayed = [];
    this.practice.failedCount = 0;
    // reset the hint counter
    this.hintCounter = 0;

    // if this is the 1st move in the line
    if (this.practice.moveIdx == 0) {
      console.log(
        "animate to starting position of line: " +
          this.practice.animateToPosition
      );

      console.log(this.practice.lines[this.practice.lineIdx]);

      // set the orientation of the board
      var orient =
        this.practice.lineColor == "white" ? COLOR.white : COLOR.black;
      if (this.board.getOrientation() != orient) {
        this.board.setOrientation(orient);
      }

      // load the PGN
      //this.game.loadPgn(pgn);

      // if this is an analysis line
      if (this.type == "analysis") {
        // set the starting position for this line
        this.game.reset();
        this.game.load(this.practice.lines[this.practice.lineIdx].fen);
        this.board.setPosition(this.game.fen());
        // update the analysis game fields
        this.analysis.fields.children[1].innerHTML =
          this.practice.lines[this.practice.lineIdx].color == "white"
            ? this.practice.lines[this.practice.lineIdx].black
            : this.practice.lines[this.practice.lineIdx].white;
        this.analysis.fields.children[3].innerHTML =
          this.practice.lines[this.practice.lineIdx].move +
          " (" +
          this.practice.lines[this.practice.lineIdx].type +
          ")";
        this.analysis.fields.children[5].href =
          this.practice.lines[this.practice.lineIdx].link;
        this.analysis.fields.children[5].innerHTML =
          this.practice.lines[this.practice.lineIdx].link;
      } else if (
        this.practice.lines[this.practice.lineIdx].line.length > 0 ||
        this.practice.lines[this.practice.lineIdx].variation
      ) {
        // if we have moves to make to get to this line
        if (this.practice.animateToPosition) {
          // reset the game & board
          this.game.reset();
          this.board.setPosition(this.game.fen());

          for (
            var i = 0;
            i < this.practice.lines[this.practice.lineIdx].line.length;
            i++
          ) {
            this.game.move(this.practice.lines[this.practice.lineIdx].line[i]);
          }

          // if this line is a variation
          if (this.practice.lines[this.practice.lineIdx].variation) {
            // make the 1st move of the variation, that was the point we left off
            this.game.move(this.practice.lines[this.practice.lineIdx].move);
          }

          // so we can get the moves
          var history = this.game.history({ verbose: true });

          console.log("history moves:");
          console.log(history);
          console.log(this.practice.lineIdx, this.practice.moveIdx);

          // disable board move input
          this.disableMoveInput();

          // animate to this position
          await this.animateMoves(history);

          console.log("animate done..");
          console.log(this.practice.lineIdx, this.practice.moveIdx);

          // enable board move input
          this.enableMoveInput();
        } else {
          /*

          New: make the move here? only if autoMove ?

          */

          // if this line is a variation
          if (this.practice.lines[this.practice.lineIdx].variation) {
            // make the 1st move of the variation, that was the point we left off
            this.game.move(this.practice.lines[this.practice.lineIdx].move);
            // get the last move
            var last = this.game.history({ verbose: true }).pop();

            // animate the move
            this.board.movePiece(last.from, last.to, true);
          }
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
      this.game.move(this.practice.lines[this.practice.lineIdx].move);
      // get the last move
      var last = this.game.history({ verbose: true }).pop();
      // undo the move
      this.game.undo();
      // mark the move that was played
      this.board.removeMarkers();
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
              this.practice.lines[this.practice.lineIdx].move +
              "</b>, which is " +
              (this.practice.lines[this.practice.lineIdx].type == "inaccuracy"
                ? "an"
                : "a") +
              " " +
              this.practice.lines[this.practice.lineIdx].type +
              ". There are " +
              moves.length +
              " good moves here."
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
              this.practice.lineMovesPlayed.length,
              multiple[i]
            );
            this.practice.lineMovesPlayed.push(multiple[i]);
          }
        }
      }

      // remember the current FEN position
      this.practice.fenPosition = this.game.fen();
    } else {
      // update the status
      if (this.type == "analysis") {
        this.showInfo(
          "You played the move <b>" +
            this.practice.lines[this.practice.lineIdx].move +
            "</b>, which is " +
            (this.practice.lines[this.practice.lineIdx].type == "inaccuracy"
              ? "an"
              : "a") +
            " " +
            this.practice.lines[this.practice.lineIdx].type +
            ". Try to find the best move."
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

    console.log(
      "getMoves: " + this.practice.lineIdx + " / " + this.practice.moveIdx
    );
    console.log(this.type);
    console.log(this.practice.lines[this.practice.lineIdx]);

    var temp = this.practice.lines[this.practice.lineIdx];
    if (this.type != "analysis") {
      for (var i = 0; i < this.practice.moveIdx; i++) {
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
      var isCorrect = this.practice.lineMoves.includes(this.lastMove);

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
        if (this.practice.failedCount == 0) {
          // add to the failed counter
          this.addFailedCount();

          // get the current FEN
          var fen = this.getFen();

          // add to the failed count
          var failed = [];

          // if we have multiple moves here
          if (this.practice.isMultiple) {
            // add only the moves that had not yet been played correctly
            for (var i = 0; i < this.practice.lineMoves.length; i++) {
              if (
                !this.practice.lineMovesPlayed.includes(
                  this.practice.lineMoves[i]
                )
              ) {
                failed.push({
                  fen: fen,
                  move: this.practice.lineMoves[i],
                  failed: 1,
                });
              }
            }
          } else {
            // add the move
            failed.push({
              fen: fen,
              move: this.practice.lineMoves[0],
              failed: 1,
            });
          }

          // save the move counters
          if (failed.length > 0) {
            this.saveMoveCounters(failed);
          }
        } else if (this.practice.isMultiple) {
          // already failed before - only add to the counter if we have multiple moves that we failed
          if (
            this.practice.failedCount + this.practice.lineMovesPlayed.length <
            this.practice.lineMoves.length
          ) {
            // add to the failed counter
            this.addFailedCount();
          }
        }

        // remember how many times we failed this move
        this.practice.failedCount++;

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
    console.log(
      "isAutoMove: " + this.practice.lineColor + " - " + this.game.turn()
    );
    return (
      (this.practice.lineColor == "white" && this.game.turn() == "b") ||
      (this.practice.lineColor == "black" && this.game.turn() == "w")
    );
  }

  // auto-move
  autoMove(next = false) {
    console.log("autoMove: " + next);
    console.log(this.type);

    // if we have multiple moves or this is an analysis line
    if (this.practice.isMultiple || this.type == "analysis") {
      // goto the next line
      this.practice.lineIdx++;
      this.practice.moveIdx = 0;

      this.practice.animateToPosition = false;

      this.runPractice();

      return;
    }

    console.log("isMultiple: " + this.practice.isMultiple);

    if (next) {
      // goto the next move
      this.practice.moveIdx++;
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
        this.practice.lineIdx++;
        this.practice.moveIdx = 0;
      } else {
        // goto the next move
        this.practice.moveIdx++;
      }

      this.practice.animateToPosition = false;
    } else {
      // goto the next line
      this.practice.lineIdx++;
      this.practice.moveIdx = 0;

      this.practice.animateToPosition = true;
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
    if (this.practice.isMultiple) {
      // if this move was already played
      if (this.practice.lineMovesPlayed.includes(this.lastMove)) {
        // update status
        this.showInfo(
          "You already played this move. Try to find the next move."
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
      this.practice.lineMovesPlayed.push(this.lastMove);

      // show the played move in the list
      this.setPlayedMove(
        this.type == "analysis"
          ? this.practice.lineMoves.indexOf(this.lastMove)
          : this.practice.lineMovesPlayed.length - 1,
        this.lastMove
      );

      // update the move counter
      this.reduceMoveCount();

      // only add to the correct counter if we haven't failed the move
      if (
        this.practice.failedCount + this.practice.lineMovesPlayed.length <=
        this.practice.lineMoves.length
      ) {
        this.addCorrectCount();
      }

      // update the counters for this move
      this.saveMoveCounters([
        { fen: this.getFen(), move: this.lastMove, correct: 1 },
      ]);

      // set the confirm message
      var nth = ["", "2nd ", "3rd "];
      var msg =
        this.type == "analysis"
          ? "That is the " +
            nth[this.practice.lineMoves.indexOf(this.lastMove)] +
            "best move."
          : "That's the correct move.";

      // if all correct moves have been played
      if (
        this.practice.lineMovesPlayed.length == this.practice.lineMoves.length
      ) {
        // update the status
        this.showConfirm(msg);

        // pause the board for a moment
        this.pauseBoard(() => {
          // hide the played moves list
          this.hidePlayedMoves();
          // remove markers
          this.board.removeMarkers();

          // move onto the next line
          this.practice.lineIdx++;
          this.practice.moveIdx = 0;

          this.practice.animateToPosition = true;

          console.log("runPractice-3");

          this.runPractice();
        }, 1500);
      } else {
        // update the status
        this.showConfirm(msg + " Try to find the next move.");

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
      this.showConfirm("That's the correct move.");

      // update the move counter
      this.reduceMoveCount();

      // if we have multiples here
      if (this.practice.lineMovesMultiple.length > 1) {
        // show the played move in the list
        this.setPlayedMove(this.practice.lineMovesPlayed.length, this.lastMove);
      }

      // if we didn't fail this move
      if (this.practice.failedCount == 0) {
        // update the correct counter
        this.addCorrectCount();
      }

      // update the counters for this move
      this.saveMoveCounters([
        { fen: this.getFen(), move: this.practice.lineMoves[0], correct: 1 },
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
      if (this.practice.lines[this.practice.lineIdx].moves.length > 0) {
        // goto the next move
        this.practice.moveIdx++;
      } else {
        // goto the next line
        this.practice.lineIdx++;
        this.practice.moveIdx = 0;
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
    this.practice.lineIdx = 0;
    this.practice.moveIdx = 0;
    this.practice.lineColor = "";
    this.practice.lineMoves = [];
    this.practice.lineMultiple = false;
    this.practice.lineMovesPlayed = [];
    this.practice.fenPosition = "";

    // toggle the buttons
    this.buttons.startPractice.disabled = true;
    this.buttons.startPractice.classList.add("hidden");
    this.buttons.giveHint.disabled = false;
    this.buttons.giveHint.classList.remove("hidden");
    this.buttons.skipMove.disabled = false;
    this.buttons.skipMove.classList.remove("hidden");

    // reset the counters
    this.showCounters(this.practice.moveCount);

    // enable board move input
    this.disableMoveInput();
    this.enableMoveInput();

    // enable the analysis buttons
    if (this.type == "analysis") {
      this.analysis.saveButton.disabled = false;
      this.analysis.ignoreButton.disabled = false;
      this.analysis.discardButton.disabled = false;
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
    this.containers.counters.classList.remove("hidden");

    this.containers.moveCounter.innerHTML = moveCount;
    this.containers.correctCounter.innerHTML = 0;
    this.containers.failedCounter.innerHTML = 0;
  }

  // hide the counters
  hideCounters() {
    this.containers.counters.classList.add("hidden");
  }

  // reduce the move count
  reduceMoveCount(count = 1) {
    this.containers.moveCounter.innerHTML =
      parseInt(this.containers.moveCounter.innerHTML) - count;
  }

  // add to the correct count
  addCorrectCount() {
    this.containers.correctCounter.innerHTML =
      parseInt(this.containers.correctCounter.innerHTML) + 1;
  }

  // add to the failed count
  addFailedCount() {
    this.containers.failedCounter.innerHTML =
      parseInt(this.containers.failedCounter.innerHTML) + 1;
  }

  // show an info message
  showInfo(status = "") {
    this.containers.confirm.classList.add("hidden");
    this.containers.warning.classList.add("hidden");
    this.containers.info.classList.remove("hidden");
    this.containers.info.getElementsByTagName("span")[1].innerHTML = status;
  }

  // show a confirmation message
  showConfirm(status = "") {
    this.containers.info.classList.add("hidden");
    this.containers.warning.classList.add("hidden");
    this.containers.confirm.classList.remove("hidden");
    this.containers.confirm.getElementsByTagName("span")[1].innerHTML = status;
  }

  // show a warning message
  showWarning(status = "") {
    this.containers.info.classList.add("hidden");
    this.containers.confirm.classList.add("hidden");
    this.containers.warning.classList.remove("hidden");
    this.containers.warning.getElementsByTagName("span")[1].innerHTML = status;
  }

  // hide the status messages
  hideStatus() {
    this.containers.info.classList.add("hidden");
    this.containers.confirm.classList.add("hidden");
    this.containers.warning.classList.add("hidden");
  }

  // give a hint
  giveHint() {
    console.log("giveHint:");

    // if this is the 1st hint
    if (this.hintCounter == 0) {
      // get the hint and show it
      var hint = this.getPieceHint();
      this.showInfo(hint);
    } else {
      // get the moves that haven't been played yet
      var notPlayed = this.practice.lineMoves.filter((move) => {
        return this.practice.lineMovesPlayed.indexOf(move) < 0;
      });

      // get the coordinates
      var coords = [];
      for (var i = 0; i < notPlayed.length; i++) {
        if (this.game.move(notPlayed[i])) {
          var last = this.game.history({ verbose: true }).pop();
          coords.push(last);
          this.game.undo();
        }
      }

      // mark the move(s)
      this.board.removeMarkers();
      if (this.hintCounter == 1) {
        for (var i = 0; i < coords.length; i++) {
          this.board.addMarker(MARKER_TYPE.square, coords[i].from);
        }
      } else {
        for (var i = 0; i < coords.length; i++) {
          this.board.addMarker(MARKER_TYPE.square, coords[i].from);
          this.board.addMarker(MARKER_TYPE.square, coords[i].to);
        }
      }
    }

    // increase the hint counter
    this.hintCounter++;
  }

  // get a hint on which piece to move
  getPieceHint() {
    console.log("getPieceHint:");

    console.log(this.practice.lineMoves);
    console.log(this.practice.lineMovesPlayed);

    var cnt =
      this.practice.lineMoves.length - this.practice.lineMovesPlayed.hint;

    //
    var pieces = {
      p: "pawn",
      R: "rook",
      N: "knight",
      B: "bishop",
      Q: "queen",
      K: "king",
    };

    //
    var notPlayed = this.practice.lineMoves.filter((move) => {
      return this.practice.lineMovesPlayed.indexOf(move) < 0;
    });

    //
    console.log("notPlayed:");
    console.log(notPlayed);

    //
    var moves = [];
    var moveCnt = 0;
    //
    for (var i = 0; i < notPlayed.length; i++) {
      console.log("move:");
      console.log(notPlayed[i]);
      console.log(pieces[notPlayed[i].charAt(0)]);

      var piece = pieces[notPlayed[i].charAt(0)]
        ? pieces[notPlayed[i].charAt(0)]
        : pieces["p"];

      console.log("piece: " + piece);

      if (moves[piece]) {
        moves[piece]++;
      } else {
        moves[piece] = 1;
        moveCnt++;
      }
    }

    // sort the moves, multiples first
    moves.sort();
    moves.reverse();

    console.log("moves:");
    console.log(moves);

    //
    var hint = "";
    var idx = 0;
    //
    for (var prop in moves) {
      console.log("prop: " + prop);

      if (hint == "") {
        if (moves[prop] == 1) {
          hint = "It's a " + prop + " move";
        } else {
          if (moves.length == 1) {
            if (moves[prop] == 2) {
              hint = "They are both " + prop + " moves";
            } else {
              hint = "They are all " + prop + " moves";
            }
          } else {
            hint = "There are " + moves[prop] + " " + prop + " moves";
          }
        }
      } else {
        if (idx + 1 == moveCnt) {
          hint += " and ";
        } else {
          hint += ", ";
        }
        if (moves[prop] == 1) {
          hint += "a " + prop + " move";
        } else {
          hint += moves[prop] + " " + prop + " moves";
        }
      }

      console.log(hint);

      idx++;
    }

    hint += ".";

    console.log(hint);

    return hint;
  }

  // skip the current move
  skipMove() {
    console.log("skipMove:");
    console.log("Multiple: " + this.practice.isMultiple);

    // update the move counter
    this.reduceMoveCount(
      this.practice.lineMoves.length - this.practice.lineMovesPlayed.length
    );

    // if we have multiple moves from here or this is an analysis
    if (this.practice.isMultiple) {
      // goto the next line
      this.practice.lineIdx++;
      this.practice.moveIdx = 0;
    } else {
      // goto the next move
      this.practice.moveIdx++;
    }

    // run the next practice
    this.runPractice();
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
