import { MyChessBoard } from "./chessboard.js";
import { COLOR } from "cm-chessboard/src/view/ChessboardView.js";
import {
  MARKER_TYPE,
  Markers,
} from "cm-chessboard/src/extensions/markers/Markers.js";
import { Utils } from "./utils.js";
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
  types = ["white", "black", "new", "recommended", "all", "analysis"];

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
    lineMovesPlayable: [],
    isMultiple: false,
    lineMovesPlayed: [],
    fenPosition: "",
    animateToPosition: true,
    paused: false,
    pausedFen: "",
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
    saveDialog: {},
  };

  constructor() {
    super();

    // show the page loader
    Utils.showLoading();

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
    this.init(el, this.type == "black" ? COLOR.black : COLOR.white);

    // disable move input
    this.disableMoveInput();

    // get the entire repertoire
    this.getRepertoire();

    // initialise the analysis elements
    this.initAnalysis();

    // initialise the dialogs
    this.initDialogs();

    // hide the page loader
    Utils.hideLoading();
  }

  initAnalysis() {
    // get the elements
    this.analysis.container = document.getElementById("analysisGameContainer");
    this.analysis.fields = document.getElementById("analysisGameFields");
    this.analysis.saveButton = document.getElementById("analysisSaveButton");
    this.analysis.ignoreButton = document.getElementById(
      "analysisIgnoreButton"
    );
    this.analysis.discardButton = document.getElementById(
      "analysisDiscardButton"
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
  }

  initDialogs() {
    // get the save modal elements
    this.analysis.saveDialog.modal = document.getElementById("saveModal");
    this.analysis.saveDialog.closeButton = document.getElementById(
      "saveModalCloseButton"
    );
    this.analysis.saveDialog.cancelButton = document.getElementById(
      "saveModalCancelButton"
    );
    this.analysis.saveDialog.confirmButton = document.getElementById(
      "saveModalConfirmButton"
    );

    this.analysis.saveDialog.textOneMove = document.getElementById(
      "saveModalTextOneMove"
    );
    this.analysis.saveDialog.textMultipleMoves = document.getElementById(
      "saveModalTextMultipleMoves"
    );
    this.analysis.saveDialog.movesList =
      document.getElementById("saveModalMovesList");

    this.analysis.saveDialog.radioTopMove = document.getElementById(
      "saveModalRadioTopMove"
    );
    this.analysis.saveDialog.radioTop2 =
      document.getElementById("saveModalRadioTop2");
    this.analysis.saveDialog.radioTop3 =
      document.getElementById("saveModalRadioTop3");

    // register the modal
    Modal.register(this.analysis.saveDialog.modal, [
      {
        element: this.analysis.saveDialog.closeButton,
        action: "close",
      },
      {
        element: this.analysis.saveDialog.cancelButton,
        action: "close",
      },
      {
        element: this.analysis.saveDialog.confirmButton,
        action: "handler",
        handler: this.onAnalysisSaveConfirmed.bind(this),
      },
    ]);

    // get the ignore modal elements
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

  /**
   * chessboard.js event handlers
   */

  afterMove(move) {
    try {
      // if practice is paused..
      if (this.practice.paused) {
        return true;
      }

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
              color: this.practice.lineColor,
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

  /**
   * Analysis functions.
   * - showAnalysis
   * - hideAnalysis
   * - onAnalysisSave
   * - onAnalysisSaveConfirmed
   * - onAnalysisIgnore
   * - onAnalysisIgnoreConfirmed
   * - onAnalysisDiscard
   * - analysisFieldsUpdate
   */

  showAnalysis() {
    // show the analysis container
    this.analysis.container.classList.remove("hidden");
    // enable the buttons
    this.analysis.saveButton.disabled = false;
    this.analysis.ignoreButton.disabled = false;
    this.analysis.discardButton.disabled = false;
  }

  hideAnalysis() {
    // hide the analysis container
    this.analysis.container.classList.add("hidden");
    // disable the buttons
    this.analysis.saveButton.disabled = true;
    this.analysis.ignoreButton.disabled = true;
    this.analysis.discardButton.disabled = true;
  }

  // fired when the analysis save to repertoire button is clicked
  onAnalysisSave(event) {
    console.log("onAnalysisSave:");
    console.log(this.practice.lines[this.practice.lineIdx]);

    // configure the save dialog
    switch (this.practice.lines[this.practice.lineIdx].moves.length) {
      case 1:
        this.analysis.saveDialog.textOneMove.classList.remove("hidden");
        this.analysis.saveDialog.textMultipleMoves.classList.add("hidden");
        this.analysis.saveDialog.movesList.classList.add("hidden");
        this.analysis.saveDialog.movesList.classList.add("sm:hidden");
        break;
      case 2:
        this.analysis.saveDialog.textOneMove.classList.add("hidden");
        this.analysis.saveDialog.textMultipleMoves.classList.remove("hidden");
        this.analysis.saveDialog.movesList.classList.remove("hidden");
        this.analysis.saveDialog.movesList.classList.remove("sm:hidden");
        this.analysis.saveDialog.radioTop2.parentNode.parentNode.classList.remove(
          "hidden"
        );
        this.analysis.saveDialog.radioTop3.parentNode.parentNode.classList.add(
          "hidden"
        );
        break;
      case 3:
        this.analysis.saveDialog.textOneMove.classList.add("hidden");
        this.analysis.saveDialog.textMultipleMoves.classList.remove("hidden");
        this.analysis.saveDialog.movesList.classList.remove("hidden");
        this.analysis.saveDialog.movesList.classList.remove("sm:hidden");
        this.analysis.saveDialog.radioTop2.parentNode.parentNode.classList.remove(
          "hidden"
        );
        this.analysis.saveDialog.radioTop3.parentNode.parentNode.classList.remove(
          "hidden"
        );
        break;
    }

    this.analysis.saveDialog.radioTopMove.checked = true;

    // show the modal
    Modal.open(this.analysis.saveDialog.modal);
  }

  // fired when the save dialog is confirmed
  onAnalysisSaveConfirmed() {
    console.log("onAnalysisSaveConfirmed:");
    console.log(this.practice.lines[this.practice.lineIdx]);

    // get the moves
    var pgn = "";
    var moves = this.historyWithCorrectFen();
    for (var i = 0; i < moves.length; i++) {
      if (i % 2 == 0) {
        pgn += i / 2 + 1 + ". ";
      }
      pgn += moves[i]["san"];

      moves[i]["pgn"] = pgn;
      moves[i]["autoplay"] = true;

      pgn += " ";
    }

    // add the engine moves
    var addIf = [
      true,
      this.analysis.saveDialog.radioTop2.checked ||
        this.analysis.saveDialog.radioTop3.checked,
      this.analysis.saveDialog.radioTop3.checked,
    ];
    var engineMoves = [];
    for (
      var i = 0;
      i < this.practice.lines[this.practice.lineIdx].moves.length;
      i++
    ) {
      // if we need to add this move
      if (addIf[i]) {
        // make the move
        this.game.move(
          this.practice.lines[this.practice.lineIdx].moves[i].move
        );
        // get the move details
        var last = this.historyWithCorrectFen().pop();
        // set the PGN value
        last["pgn"] = pgn + last["san"];
        // add to the engine moves array
        engineMoves.push(last);
        // undo the move
        this.game.undo();
      }
    }

    console.log("Moves:");
    console.log(engineMoves);

    // add the engine moves
    moves.push({ moves: engineMoves });

    // set the API url
    var url = "/api/analysis/save";

    // set the data object
    var data = {
      color: this.practice.lines[this.practice.lineIdx].color,
      initialFen: this.practice.lines[this.practice.lineIdx].initialFen,
      fen: this.practice.lines[this.practice.lineIdx].fen,
      move: this.practice.lines[this.practice.lineIdx].move,
      moves: moves,
    };

    console.log(data);

    // delete the analysis move
    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);
      })
      .catch((error) => {
        console.error("Error:", error);
      });

    // remove from the current practice lines
    this.onAnalysisDiscard(null, false);

    // close the modal
    Modal.close(this.analysis.saveDialog.modal);
  }

  // fired when the analysis ignore button is clicked
  onAnalysisIgnore(event) {
    console.log("onAnalysisIgnore:");

    // show the modal
    Modal.open(this.analysis.ignoreDialog.modal);
  }

  // fired when the ignore dialog is confirmed
  onAnalysisIgnoreConfirmed() {
    console.log("onAnalysisIgnoreConfirmed:");

    // set the API url
    var url = "/api/analysis/ignore";
    // set the data
    var data = {
      fen: this.practice.lines[this.practice.lineIdx].fen,
      move: this.practice.lines[this.practice.lineIdx].move,
    };

    // delete the analysis move
    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);
      })
      .catch((error) => {
        console.error("Error:", error);
      });

    // remove from the current practice lines
    this.onAnalysisDiscard(null, false);

    // close the modal
    Modal.close(this.analysis.ignoreDialog.modal);
  }

  // fired when the analysis discard button is clicked
  onAnalysisDiscard(event, removeFromDb = true) {
    // if we need to remove this move from the database
    if (removeFromDb) {
      // set the API url
      var url = "/api/analysis";
      // set the data
      var data = {
        fen: this.practice.lines[this.practice.lineIdx].fen,
        move: this.practice.lines[this.practice.lineIdx].move,
      };

      // delete the analysis move
      fetch(url, {
        method: "DELETE",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((response) => {
          console.log("Success:");
          console.log(response);
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }

    console.log(
      "onDiscard: " + this.practice.lineIdx + " / " + this.practice.moveIdx
    );

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

    console.log("reduceBy: " + reduceBy);

    // update the move counter
    if (reduceBy > 0) {
      this.practice.moveCount = this.practice.moveCount - reduceBy;
      this.reduceMoveCount(reduceBy);
    }

    // proceed to the 1st move of the next line (current line was removed, so no need to increase line index)
    this.practice.moveIdx = 0;

    // animate to the next position
    this.practice.animateToPosition = true;

    // continue the practice
    this.continuePractice(false);
  }

  // update the analysis game fields
  analysisFieldsUpdate() {
    // set the opponent name
    this.analysis.fields.children[1].innerHTML =
      this.practice.lines[this.practice.lineIdx].color == "white"
        ? this.practice.lines[this.practice.lineIdx].black
        : this.practice.lines[this.practice.lineIdx].white;
    // set the move that was played
    this.analysis.fields.children[3].innerHTML =
      this.practice.lines[this.practice.lineIdx].move +
      " (" +
      this.practice.lines[this.practice.lineIdx].type +
      ")";
    // set the game link
    this.analysis.fields.children[7].href =
      this.practice.lines[this.practice.lineIdx].link;
    this.analysis.fields.children[7].innerHTML =
      this.practice.lines[this.practice.lineIdx].link;

    // if we have an initial fen
    if (
      this.practice.lines[this.practice.lineIdx].initialFen &&
      this.practice.lines[this.practice.lineIdx].initialFen != ""
    ) {
      // show the initial fen fields
      this.analysis.fields.children[4].classList.remove("hidden");
      this.analysis.fields.children[5].classList.remove("hidden");

      // set the initial fen
      this.analysis.fields.children[5].innerHTML =
        this.practice.lines[this.practice.lineIdx].initialFen;
    } else {
      // hide the initial fen fields
      this.analysis.fields.children[4].classList.add("hidden");
      this.analysis.fields.children[5].classList.add("hidden");
    }
  }

  /**
   * Practice handling functions.
   * - onMoveFinished
   * - pausePractice
   * - continuePractice
   * - gotoNextMove
   * - gotoNextLine
   * - onFinishPractice
   */

  /**
   * Called once a move is finished. If there is only 1 move for a position, it's called after that move
   * is played correctly. If there are multiple correct moves for this position, this function is called once
   * all those moves have been played correctly.
   *
   * Here you decide what to do next:
   * - goto the next move (or line)
   * - pause until the user says to continue
   * - etc
   *
   * @memberof Practice
   */
  onMoveFinished(action = "pause") {
    // if this is an analysis line
    if (this.type == "analysis") {
      // wait before proceeding to the next line
      action = "wait";

      // remember the current position
      this.practice.pausedFen = this.game.fen();

      // undo the current move after a short pause (unless the user already continued)
      this.pauseBoard(() => {
        // if still paused
        if (this.practice.paused) {
          // if we still have the last position
          //if (this.practice.pausedFen == this.game.fen()) {
          // undo the last move
          //this.game.undo();
          //this.board.setPosition(this.game.fen());
          //}
          // remove markers
          this.board.removeMarkers();
        }
      });
    }

    switch (action) {
      case "continue":
        // continue the practice
        this.continuePractice();
        break;
      case "wait":
        // wait for user interaction before continueing
        this.pausePractice();
        break;
      default:
        // pause for a moment before continueing
        this.pauseBoard(() => {
          // continue the practice
          this.continuePractice();
        }, 1500);
        break;
    }
  }

  // pause the practice
  pausePractice() {
    this.practice.paused = true;

    // set the skip move button text
    this.buttons.skipMove.innerHTML = "Continue";
  }

  // continue the practice
  continuePractice(gotoNext = true) {
    // if practice was paused
    if (this.practice.paused) {
      // set the skip move button text
      this.buttons.skipMove.innerHTML = "Skip this move";
    }

    this.practice.paused = false;

    // hide the played moves list
    this.hidePlayedMoves();
    // remove markers
    this.board.removeMarkers();

    console.log("continuePractice: gotoNext = " + gotoNext);
    console.log(
      "line, move: " + this.practice.lineIdx + " / " + this.practice.moveIdx
    );

    // goto the next move or line
    if (gotoNext) {
      if (this.practice.isMultiple) {
        this.gotoNextLine(true);
      } else {
        this.gotoNextMove(true);
      }
    } else {
      this.runPractice();
    }
  }

  // goto the next move
  gotoNextMove(animate = this.practice.animateToPosition) {
    // goto the next move
    this.practice.moveIdx++;

    console.log("gotoNextMove: " + this.practice.moveIdx);

    this.practice.animateToPosition = animate;

    this.runPractice();
  }

  // goto the next line
  gotoNextLine(animate = this.practice.animateToPosition) {
    // goto the next line
    this.practice.lineIdx++;
    this.practice.moveIdx = 0;

    console.log(
      "gotoNextLine: " +
        this.practice.lineIdx +
        " / " +
        this.practice.moveIdx +
        " -- animate: " +
        animate
    );

    this.practice.animateToPosition = animate;

    this.runPractice();
  }

  // called when a practice is finished, all moves played
  // show info ? toggle buttons, etc..
  onFinishPractice() {}

  /**
   * Repertoire functions:
   * - getRepertoire
   * - onGetRepertoire
   * - showRepertoireType
   * - initRepertoireButtons
   * - toggleRepertoireButtons
   */

  // get the repertoire
  getRepertoire() {
    var url = "/api/practice";

    // show the page loader
    Utils.showLoading();

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
      .catch((error) => console.error("Error:", error))
      .finally(() => {
        // hide the page loader
        Utils.hideLoading();
      });
  }

  // enable the practice
  onGetRepertoire(json) {
    this.repertoire = json;
    // enable the start practice button
    this.buttons.startPractice.disabled = false;

    // get the number of moves (ours) for the different repertoires
    var moveCounts = ["", "", 0, 0, "", 0];
    this.practice.lines = [];
    moveCounts[2] = this.getPracticeLines("new", this.repertoire["new"]);
    this.practice.lines = [];
    moveCounts[3] = this.getPracticeLines(
      "recommended",
      this.repertoire["recommended"]
    );
    this.practice.lines = [];
    moveCounts[5] = this.getPracticeLines(
      "analysis",
      this.repertoire["analysis"]
    );
    /*
    for (var i = 0; i < this.types.length; i++) {
      this.practice.lines = [];
      moveCounts[i] = this.getPracticeLines(
        this.types[i],
        this.types[i] == "all"
          ? [...this.repertoire["white"], ...this.repertoire["black"]]
          : this.repertoire[this.types[i]]
      );
    }
      */

    // toggle the repertoire type buttons
    this.toggleRepertoireButtons(moveCounts);

    // get the right repertoire
    var rep =
      this.type == "all"
        ? [...this.repertoire["white"], ...this.repertoire["black"]]
        : this.repertoire[this.type];

    console.log("REP [" + this.type + "]:");
    console.log(rep);

    this.practice.lines = [];

    // get the practice lines
    this.practice.moveCount = this.getPracticeLines(this.type, rep);

    console.log("practiceLines: " + this.practice.moveCount);
    console.log(this.practice.lines);

    // show the counters
    this.showCounters(this.practice.moveCount);
  }

  // show a different repertoire type
  showRepertoireType(type) {
    // stop the current practice
    this.stopPractice();
    // set the type
    this.type = type;
    // reset the board
    this.game.reset();
    this.board.setPosition(this.game.fen());
    // set the orientation
    var orient = this.type == "black" ? COLOR.black : COLOR.white;
    if (this.board.getOrientation() != orient) {
      this.board.setOrientation(orient);
    }

    // disable move input
    this.disableMoveInput();

    // refresh the repertoire
    this.getRepertoire();
  }

  // add event listeners to the repertoire type buttons
  initRepertoireButtons() {
    this.buttons.repertoireType.children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("white");
      }
    );
    this.buttons.repertoireType.children[1].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("black");
      }
    );
    this.buttons.repertoireType.children[2].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("new");
      }
    );
    this.buttons.repertoireType.children[3].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("recommended");
      }
    );
    this.buttons.repertoireType.children[4].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("all");
      }
    );
    this.buttons.repertoireType.children[5].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("analysis");
      }
    );
  }

  // toggle the repertoire type buttons
  toggleRepertoireButtons(moveCounts) {
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

    this.buttons.repertoireType.children[2].children[0].innerHTML =
      moveCounts[2];
    this.buttons.repertoireType.children[3].children[0].innerHTML =
      moveCounts[3];
    this.buttons.repertoireType.children[5].children[0].innerHTML =
      moveCounts[5];

    // select the right type
    var idx = this.types.indexOf(this.type);
    // set to "all" if there are no practice lines for this type
    if (idx == -1 || this.buttons.repertoireType.children[idx].disabled) {
      this.type = "all";
      idx = this.types.indexOf(this.type);
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

  // split the repertoire into practice lines
  getPracticeLines(
    type,
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

      var playableCnt = 0;
      if (ourMove) {
        for (var x = 0; x < lines[i].moves.length; x++) {
          if (!lines[i].moves[x].autoplay) {
            playableCnt++;
          }
        }
      }

      // the total moves for this line
      //var lineMoveTotal = ourMove ? this.type == "analysis" ? 1 : lines[i].moves.length : 0;
      var lineMoveTotal = ourMove ? playableCnt : 0;

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
      if (type != "analysis" && lines[i].moves.length > 0) {
        // add this move to the line moves array
        var line = lineMoves.slice(0);
        if (lines[i].move) {
          line.push(lines[i].move);
        }

        // get the practice lines
        var sub = this.getPracticeLines(
          type,
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

  /**
   * Practice functions.
   * - onStartPractice
   * - stopPractice
   * - runPractice
   */

  // start the practice
  async onStartPractice() {
    console.log("startPractice:");

    // reset vars
    this.practice.lineIdx = 0;
    this.practice.moveIdx = 0;
    this.practice.lineColor = "";
    this.practice.lineMoves = [];
    this.practice.lineMovesMultiple = [];
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

    // toggle the analysis container
    if (this.type == "analysis") {
      // show the analysis container
      this.showAnalysis();
    }

    console.log("runPractice-5");

    // animate to starting position
    this.practice.animateToPosition = true;

    // run the practice
    this.runPractice();

    return;
  }

  // stop a practice (when switching type)
  stopPractice() {
    // toggle the buttons
    this.buttons.startPractice.disabled = false;
    this.buttons.startPractice.innerHTML = "Start your practice";
    this.buttons.startPractice.classList.remove("hidden");
    this.buttons.giveHint.disabled = true;
    this.buttons.giveHint.classList.add("hidden");
    this.buttons.skipMove.disabled = true;
    this.buttons.skipMove.classList.add("hidden");

    // hide the played moves container
    this.hidePlayedMoves();

    // toggle the analysis container
    if (this.type == "analysis") {
      // hide the analysis container
      this.hideAnalysis();
    }

    // show info
    this.showInfo("To start your practice, click the button above.");
  }

  // run the practice
  async runPractice() {
    console.log(
      "runPractice: lineIdx = " +
        this.practice.lineIdx +
        ", moveIdx = " +
        this.practice.moveIdx +
        ", animate = " +
        this.practice.animateToPosition
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

      // hide the played moves container
      if (this.type != "analysis") {
        this.hidePlayedMoves();
      }

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
    var [moves, multiple, playable] = this.getMoves();

    // if no more moves or next move for analysis line..
    if (
      moves.length == 0 ||
      (this.type == "analysis" && this.practice.moveIdx > 0)
    ) {
      console.log("runPractice: gotoNextLine");

      // goto the next line
      this.gotoNextLine(true);

      return;
    }

    // set the practice line vars
    this.practice.isMultiple = moves.length > 1;
    this.practice.lineMoves = moves;
    this.practice.lineMovesMultiple = multiple;
    this.practice.lineMovesPlayable = playable;
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

      // set the orientation of the board
      var orient =
        this.practice.lineColor == "white" ? COLOR.white : COLOR.black;
      if (this.board.getOrientation() != orient) {
        this.board.setOrientation(orient);
      }

      // load the PGN
      //this.game.loadPgn(pgn);

      /*
      // if this is an analysis line
      if (this.type == "analysis") {
        // set the starting position for this line
        this.game.reset();

        // if we have an initial starting position
        if (
          this.practice.lines[this.practice.lineIdx].initialFen &&
          this.practice.lines[this.practice.lineIdx].initialFen != ""
        ) {
          this.game.load(this.practice.lines[this.practice.lineIdx].initialFen);
        }

        // make all the line moves
        for (
          var i = 0;
          i < this.practice.lines[this.practice.lineIdx].line.length;
          i++
        ) {
          // safety check (empty move - need to fix this in api)
          if (this.practice.lines[this.practice.lineIdx].line[i] != "") {
            this.game.move(this.practice.lines[this.practice.lineIdx].line[i]);
          }
        }

        // update the board position
        this.board.setPosition(this.game.fen());

        // update the analysis game fields
        this.analysisFieldsUpdate();
        
      } else if (*/
      if (
        this.type == "analysis" ||
        this.practice.lines[this.practice.lineIdx].line.length > 0 ||
        this.practice.lines[this.practice.lineIdx].variation ||
        (this.practice.lines[this.practice.lineIdx].initialFen &&
          this.practice.lines[this.practice.lineIdx].initialFen != "")
      ) {
        // if we have moves to make to get to this line
        if (this.type == "analysis" || this.practice.animateToPosition) {
          // reset the game & board
          this.game.reset();

          // if we have an initial starting position
          if (
            this.practice.lines[this.practice.lineIdx].initialFen &&
            this.practice.lines[this.practice.lineIdx].initialFen != ""
          ) {
            this.game.load(
              this.practice.lines[this.practice.lineIdx].initialFen
            );
          }

          // update the board
          this.board.setPosition(this.game.fen());

          for (
            var i = 0;
            i < this.practice.lines[this.practice.lineIdx].line.length;
            i++
          ) {
            this.game.move(this.practice.lines[this.practice.lineIdx].line[i]);
          }

          // if this line is a variation
          if (
            this.practice.lines[this.practice.lineIdx].variation &&
            this.type != "analysis"
          ) {
            // make the 1st move of the variation, that was the point we left off
            this.game.move(this.practice.lines[this.practice.lineIdx].move);
          }

          // so we can get the moves
          var history = this.game.history({ verbose: true });

          // disable board move input
          this.disableMoveInput();

          // animate to this position
          if (this.type == "analysis") {
            // if there are any moves
            if (history.length > 0) {
              // undo the last move
              var last = history.pop();

              console.log(last);

              // update the board
              await this.board.setPosition(last.before, true);

              // pauseBoard
              // animate the last move
              await this.animateMoves([last]);
            }
          } else {
            await this.animateMoves(history);
          }

          // enable board move input
          this.enableMoveInput();
        } else if (this.practice.lines[this.practice.lineIdx].variation) {
          // make the 1st move of the variation, that was the point we left off
          this.game.move(this.practice.lines[this.practice.lineIdx].move);
          // get the last move
          var last = this.game.history({ verbose: true }).pop();

          // animate the move
          await this.board.movePiece(last.from, last.to, true);
          // update the board (in case of castling)
          this.board.setPosition(this.game.fen());
        }

        // if this is an analysis line
        if (this.type == "analysis") {
          // update the analysis game fields
          this.analysisFieldsUpdate();
        }
      } else if (colorChanged) {
        // reset the game & board
        this.game.reset();
        this.board.setPosition(this.game.fen());
      }
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
      //if (moves.length < multiple.length) {
      if (playable.length < multiple.length) {
        this.showInfo(
          "You have " +
            (multiple.length - playable.length) +
            " more move" +
            (multiple.length - playable.length > 1 ? "s" : "") +
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
      //if (moves.length < multiple.length) {
      if (playable.length < multiple.length) {
        for (var i = 0; i < multiple.length; i++) {
          if (!playable.includes(multiple[i])) {
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
      } else if (playable.length > 0) {
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
      "getMoves (" +
        this.type +
        "): " +
        this.practice.lineIdx +
        " / " +
        this.practice.moveIdx
    );
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

    // get the playable moves (not the autoplay moves)
    var playable = [];
    for (var i = 0; i < temp.moves.length; i++) {
      if (!temp.moves[i].autoplay) {
        playable.push(temp.moves[i].move);
      }
    }

    return [moves, temp.multiple, playable];
  }

  // wait on next move (use auto-play if needed)
  waitOnMove() {
    // if we need to auto-move
    if (this.isAutoMove()) {
      // auto-move (for other color)
      this.autoMove();
    } else {
      // add last move markers
      this.afterMakeMove();
    }
  }

  // do we need to auto-move?
  isAutoMove() {
    console.log(
      "isAutoMove: " + this.practice.lineColor + " - " + this.game.turn()
    );
    return (
      (this.practice.lineColor == "white" && this.game.turn() == "b") ||
      (this.practice.lineColor == "black" && this.game.turn() == "w") ||
      (this.practice.lineMoves.length == 1 &&
        this.practice.lineMovesPlayable.length == 0)
    );
  }

  // auto-move
  async autoMove(next = false) {
    console.log("autoMove: " + next);
    console.log(this.type);

    // if we have multiple moves or this is an analysis line
    if (this.practice.isMultiple || this.type == "analysis") {
      // goto the next line
      this.gotoNextLine();

      return;
    }

    console.log("isMultiple: " + this.practice.isMultiple);

    if (next) {
      // goto the next move
      this.practice.moveIdx++;
    }

    // get the next moves
    var [moves, multiple, playable] = this.getMoves();

    console.log(moves);
    console.log(multiple);

    // if any moves to play
    if (moves.length > 0) {
      // make the move
      this.game.move(moves[0]);
      // get the last move
      var last = this.game.history({ verbose: true }).pop();

      // animate the move
      await this.board.movePiece(last.from, last.to, true);
      // update the board (in case of castling)
      this.board.setPosition(this.game.fen());

      // if we have multiple moves from here
      if (moves.length > 1) {
        // goto the next line
        this.gotoNextLine(false);
      } else {
        // goto the next move
        this.gotoNextMove(false);
      }
    } else {
      // goto the next line
      this.gotoNextLine(true);
    }

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
        {
          color: this.practice.lineColor,
          fen: this.getFen(),
          move: this.lastMove,
          correct: 1,
        },
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

        //
        // -- onMoveFinished()
        //
        console.log("Call onMoveFinished (next line)");

        this.onMoveFinished();

        /*
        // pause the board for a moment
        this.pauseBoard(() => {
          // hide the played moves list
          this.hidePlayedMoves();
          // remove markers
          this.board.removeMarkers();

          // goto the next line
          this.gotoNextLine(true);
        }, 1500);
        */
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
        {
          color: this.practice.lineColor,
          fen: this.getFen(),
          move: this.practice.lineMoves[0],
          correct: 1,
        },
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

      //
      // -- onMoveFinished()
      //
      console.log("Call onMoveFinished (next more or line)");

      this.onMoveFinished();

      /*

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
      */
    }
  }

  // animate the moves 1 by 1
  async animateMoves(moves, lastOnly = false) {
    // animate the moves 1 by 1 (except for the last move)
    for (var i = 0; i < moves.length; i++) {
      await this.board.movePiece(
        moves[i]["from"],
        moves[i]["to"],
        lastOnly ? i + 1 == moves.length : true
      );
      // update the board (in case of castling)
      this.board.setPosition(moves[i].after);
    }
  }

  /**
   * Counters functions.
   * - showCounters
   * - hideCounters
   * - reduceMoveCount
   * - addCorrectCount
   * - addFailedCount
   * - saveMoveCounters
   */

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

  /**
   * Saves counters for 1 or multiple moves.
   *
   * moves: [{ fen: <fen>, move: <move>, [correct: 1 | failed: 1] }]
   *
   * @param {*} moves
   * @memberof Practice
   */
  saveMoveCounters(moves) {
    console.log("saveMoveCounters: " + this.type);
    console.log(moves);

    // not for analysis moves
    if (this.type == "analysis") {
      return false;
    }

    // set the url
    var url = "api/repertoire/counters";

    var data = { moves: moves };

    // update the move counters
    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  /**
   * Info containers functions.
   * - showInfo
   * - showConfirm
   * - showWarning
   * - hideStatus
   */

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

  /**
   * Practice buttons functions.
   * - giveHint
   * - getPieceHint
   * - skipMove
   */

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
  async skipMove() {
    console.log("skipMove: " + this.practice.paused);
    console.log("Multiple: " + this.practice.isMultiple);

    // if practice was paused
    if (this.practice.paused) {
      // continue practice
      this.continuePractice();

      return;
    }

    // update the move counter
    this.reduceMoveCount(
      this.practice.lineMoves.length - this.practice.lineMovesPlayed.length
    );

    // if we have multiple moves from here or this is an analysis
    if (this.practice.isMultiple) {
      // goto the next line
      this.gotoNextLine(this.practice.animateToPosition);
    } else {
      console.log("Skipping to move: " + this.practice.moveIdx);

      // get the next moves
      var [moves, multiple, playable] = this.getMoves();

      console.log(moves);

      /*

      - animate this move only if there are followup moves
      - if not, it animates the move and then goes to the next line
      - which it animates also, doesnt make sense, the move wasnt really 

      */

      // if we have a move to play (with a move after that)
      if (
        moves.length > 0 &&
        moves[0].moves &&
        moves[0].moves.length > 0 &&
        this.type != "analysis"
      ) {
        // make the move
        this.game.move(moves[0]);
        // get the last move
        var last = this.game.history({ verbose: true }).pop();

        // animate the move
        await this.board.movePiece(last.from, last.to, true);
        // update the board (in case of castling)
        this.board.setPosition(this.game.fen());

        console.log("Animated to position.");

        // goto the next move
        this.gotoNextMove(this.practice.animateToPosition);
      } else {
        // goto the next line
        this.gotoNextLine(this.practice.animateToPosition);
      }
    }
  }

  /**
   * Played moves container functions.
   * - showPlayedMoves
   * - hidePlayedMoves
   * - setPlayedMove
   */

  // show the played moves container
  showPlayedMoves(count) {
    console.log("showPlayedMoves: " + count);
    console.log(this.playedMovesList);

    // clear the moves list
    while (this.playedMovesList.lastChild) {
      this.playedMovesList.removeChild(this.playedMovesList.firstChild);
    }

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

  // hide the played moves container
  hidePlayedMoves() {
    this.playedMovesContainer.classList.add("hidden");
  }

  // add a move to the played moves container
  setPlayedMove(index, move) {
    console.log(this.playedMovesList);
    console.log(this.playedMovesList.children);

    // set the move
    this.playedMovesList.children[index].innerHTML =
      this.game.moveNumber() + ". " + move;
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var practice = new Practice();
});
