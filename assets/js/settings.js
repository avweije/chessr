import { MyChess } from "chess";
import { Chessboard, FEN } from "../vendor/cm-chessboard/src/Chessboard.js";
import { COLOR } from "../vendor/cm-chessboard/src/view/ChessboardView.js";
import { Markers } from "../vendor/cm-chessboard/src/extensions/markers/Markers.js";
import { Utils } from "utils";
import { PIECE_TILESIZE } from "chessboard";
import { ThickerArrows } from "ThickerArrows";

import "../styles/chessboard.css";

/**
 * Controller class for the settings page.
 */
class Settings {
  tabs = {
    buttons: null,
    board: null,
    engine: null,
    practice: null,
    account: null,
  };

  // The page elements
  elements = [];

  board = null;

  settings = [];

  animateInProgress = false;
  animateCancel = false;
  animateCounter = 0;

  constructor() {
    // Get the elements
    this.getElements();
    // Add the event listeners
    this.addListeners();
  }

  getElements() {
    // Get the data-elements for reference
    this.elements = {};
    document.querySelectorAll("[data-element]").forEach(el => {
      if (el.dataset.element !== "yes") return;
      this.elements[el.id] = el;
    });

    // get the elements
    this.tabs.buttons = document.getElementById("settingsTabButtons");
    this.tabs.account = document.getElementById("settingsTabAccount");
    this.tabs.board = document.getElementById("settingsTabBoard");
    this.tabs.engine = document.getElementById("settingsTabEngine");
    this.tabs.practice = document.getElementById("settingsTabPractice");
  }

  addListeners() {
    // Add tab event listeners
    for (let i = 0; i < this.tabs.buttons.children.length; i++) {
      this.tabs.buttons.children[i].children[0].addEventListener("click", this.onSwitchTab.bind(this));
    };

    // Toggle send email button on email address change
    this.elements.accountEmailAddress.addEventListener("input", () => {
      if (
        this.elements.accountEmailAddress.value == "" ||
        this.elements.accountEmailAddress.value == this.settings.email
      ) {
        this.elements.accountConfirmContainer.classList.add("is-hidden");
      } else {
        this.elements.accountConfirmContainer.classList.remove("is-hidden");
      }
    });
    // unlock email address input
    this.elements.unlockEmailAddressButton.addEventListener("click", () => {
      this.elements.accountEmailAddress.disabled = false;
      this.elements.unlockEmailAddressButton.classList.add("is-hidden");
    });
    // send verification email
    this.elements.sendVerificationEmailButton.addEventListener(
      "click", this.sendVerificationEmail.bind(this));

      // Add select and range input change handlers
    this.elements.boardThemeSelect.addEventListener("change", this.onChangeBoardSettings.bind(this));
    this.elements.boardPiecesSelect.addEventListener("change", this.onChangeBoardSettings.bind(this));
    this.elements.animationDuration.addEventListener("change", this.onChangeAnimationDuration.bind(this));
    this.elements.repertoireEngineTime.addEventListener("change", this.updateSettings.bind(this));
    this.elements.animateVariation.addEventListener("change", this.updateSettings.bind(this));
    this.elements.recommendInterval.addEventListener("change", this.updateSettings.bind(this));
    this.elements.balloonsAmount.addEventListener("change", this.updateSettings.bind(this));
    this.elements.analyseEngineTime.addEventListener("change", this.updateSettings.bind(this));
    this.elements.analyseIgnoreInaccuracy.addEventListener("change", this.updateSettings.bind(this));
    this.elements.analyseMistakeTolerance.addEventListener("change", this.updateSettings.bind(this));

    // get the settings
    this.getSettings();
  }

  // Switch tabs
  onSwitchTab() {
    // Hide all tabs
    for (const key of ["board", "engine", "practice", "account"]) {
      this.tabs[key].classList.add("is-hidden");
    }

    // Show the selected tab
    for (let i = 0; i < this.tabs.buttons.children.length; i++) {
      if (this.tabs.buttons.children[i].children[0].checked) {
        const key = ["board", "engine", "practice", "account"][i];
        this.tabs[key].classList.remove("is-hidden");
      }
    }
  }

  // Send the verification email
  sendVerificationEmail() {
    console.info("sendVerificationEmail");
  }

  // Switch board theme
  onChangeBoardSettings(event) {
    // Update the chessboard
    this.createChessboard(
      this.elements.boardThemeSelect.value,
      this.elements.boardPiecesSelect.value,
      this.elements.animationDuration.value
    );
    // Update the settings
    this.updateSettings();
  }

  // Called when animation duration slider changes value
  onChangeAnimationDuration(event) {
    // Cancel the current animation
    this.animateCancel = true;
    // Update the board & the settings
    this.onChangeBoardSettings();
    // Increase the animate id
    this.animateCounter++;
    // Start the animation
    this.startAnimation();
  }

  // start the piece animation
  startAnimation() {
    // if already in progress
    if (this.animateInProgress) {
      // cancel the current animation
      this.animateCancel = true;
      // start the animation after a short pause
      setTimeout(() => {
        this.runAnimation(this.animateCounter);
      }, 500);
    } else {
      this.runAnimation(this.animateCounter);
    }
  }

  // run an animation
  async runAnimation(animateId) {
    // if we need to run this animation
    if (animateId !== this.animateCounter) {
      return false;
    }

    // the moves we're going to animate
    const moves = [
      "e4",
      "c5",
      "c3",
      "Nf6",
      "e5",
      "Nd5",
      "Nf3",
      "d6",
      "Bb5+",
      "Bd7",
      "Bc4",
      "Nb6",
      "Bxf7+",
      "Kxf7",
      "e6+",
      "Bxe6",
      "Ng5+",
      "Kf6",
      "Qf3+",
      "Kxg5",
      "h4+",
      "Kg6",
      "h5+",
      "Kh6",
      "Qe3+",
      "g5",
      "Qxe6+",
      "Kg7",
      "h6#",
    ];

    this.animateInProgress = true;
    this.animateCancel = false;

    try {
      // create a new game
      const game = new MyChess();
      // set the board position
      this.board.setPosition(game.fen());
      // animate the moves 1 by 1
      for (let i = 0; i < moves.length; i++) {
        // make the move and get the info
        game.move(moves[i]);
        const last = game.history({ verbose: true }).pop();

        // animate the move
        await this.board.movePiece(last.from, last.to, true);

        // if we need to stop animating
        if (this.animateCancel) {
          this.animateCancel = false;
          break;
        }

        // update the board (in case of castling)
        this.board.setPosition(last.after);
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.animateInProgress = false;
    }
  }

  // get the settings
  getSettings() {
    // show the page loader
    Utils.showLoading();

    const url = "/api/settings";
    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        // store the settings
        this.onGetSettings(response.settings);
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

  onGetSettings(settings) {
    // store the settings
    this.settings = settings;

    // update the inputs with the settings
    this.elements.accountEmailAddress.value = settings.email;
    if (settings.board) {
      this.elements.boardThemeSelect.value = settings.board;
    }
    if (settings.pieces) {
      this.elements.boardPiecesSelect.value = settings.pieces;
    }
    this.elements.animationDuration.value = settings.animation_duration;
    // Engine settings
    this.elements.repertoireEngineTime.value = settings.repertoire_engine_time;
    this.elements.analyseEngineTime.value = settings.analyse_engine_time;
    this.elements.analyseIgnoreInaccuracy.checked =
      settings.analyse_ignore_inaccuracy;
    this.elements.analyseMistakeTolerance.value = settings.analyse_mistake_tolerance;
    // Practice settings
    this.elements.recommendInterval.value = settings.recommend_interval;
    this.elements.balloonsAmount.value = settings.balloons_amount;
    this.elements.animateVariation.checked = settings.animate_variation;

    // update the range input titles
    this.updateRangeInputTitles();

    // create the chess board
    this.createChessboard(
      this.elements.boardThemeSelect.value,
      this.elements.boardPiecesSelect.value,
      this.elements.animationDuration.value
    );
  }

  // update the range input titles
  updateRangeInputTitles() {
    // Get the minutes and seconds for the repertoire engine time
    const m = Math.floor(parseInt(this.elements.repertoireEngineTime.value) / 60);
    const s = parseInt(this.elements.repertoireEngineTime.value) - m * 60;
    // Set the animation duration title
    this.elements.animationDuration.title =
      this.elements.animationDuration.value + "ms";
    // Set the repertoire engine time title
    this.elements.repertoireEngineTime.title =
      m > 0 ? m + "m " + (s > 0 ? s + "s" : "") : s + "s";
    // Set the analyse engine time title
    this.elements.analyseEngineTime.title =
      parseInt(this.elements.analyseEngineTime.value) == 500
        ? this.elements.analyseEngineTime.value + "ms"
        : parseInt(this.elements.analyseEngineTime.value) / 1000 + "s";
    // Set the analyse mistake tolerance title
    this.elements.analyseMistakeTolerance.title = ["200", "500", "800"][
      parseInt(this.elements.analyseMistakeTolerance.value)
    ] + " centipawns";
    // Set the practice recommend interval title
    this.elements.recommendInterval.title = ["Less", "Average", "More", "Most"][
      parseInt(this.elements.recommendInterval.value)
    ];
    // Set the practice balloons amount title
    this.elements.balloonsAmount.title = ["(N)one", "A few", "A bunch", "A lot"][
      parseInt(this.elements.balloonsAmount.value)
    ];
  }

  // update the settings
  updateSettings() {
    const url = "/api/settings";

    // update the range input titles
    this.updateRangeInputTitles();

    // set the data object
    const data = {
      settings: {
        board: this.elements.boardThemeSelect.value,
        pieces: this.elements.boardPiecesSelect.value,
        animation_duration: this.elements.animationDuration.value,
        repertoire_engine_time: this.elements.repertoireEngineTime.value,
        analyse_engine_time: this.elements.analyseEngineTime.value,
        analyse_ignore_inaccuracy: this.elements.analyseIgnoreInaccuracy.checked,
        analyse_mistake_tolerance: this.elements.analyseMistakeTolerance.value,
        recommend_interval: this.elements.recommendInterval.value,
        balloons_amount: this.elements.balloonsAmount.value,
        animate_variation: this.elements.animateVariation.checked,
      },
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
        console.log("Success:");
        console.log(response);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError(error);
      });
  }

  // create or update the chessboard
  createChessboard(
    cssClass = "chess-club",
    piecesFile = "standard.svg",
    animationDuration = 300
  ) {
    try {
      // if we are updating
      if (this.board) {
        // destroy the current board
        this.board.destroy();
        this.board = null;
      }

      // get the correct tileSize
      const tileSize = PIECE_TILESIZE.get(piecesFile);

      // create the chess board
      this.board = new Chessboard(this.elements.board, {
        position: FEN.start,
        orientation: COLOR.white,
        assetsUrl: "/assets/", // wherever you copied the assets folder to, could also be in the node_modules folder
        assetsCache: false,
        style: {
          cssClass: cssClass, // set the css theme of the board, try "green", "blue" or "chess-club"
          showCoordinates: true, // show ranks and files
          aspectRatio: 1, // height/width of the board
          pieces: {
            file: "pieces/" + piecesFile, // the filename of the sprite in `assets/pieces/` or an absolute url like `https://…` or `/…`
            tileSize: tileSize,
          },
          animationDuration: animationDuration, // pieces animation duration in milliseconds. Disable all animations with `0`
        },
        extensions: [
          {
            class: Markers,
            props: { sprite: "extensions/markers/markers.svg" },
          },
          { class: ThickerArrows },
        ],
      });

      // Remove the skeleton block
      if (this.elements.board.previousElementSibling 
          && this.elements.board.previousElementSibling.classList.contains('skeleton-block')) {
        this.elements.board.parentNode.removeChild(this.elements.board.previousElementSibling);
      }
    } catch (err) {
      console.error(err);
    }
  }
}

document.addEventListener("DOMContentLoaded", (event) => {
  const settings = new Settings();
});