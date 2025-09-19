import { MyChess } from "chess";
import { UCI } from "uci";

/**
 * Helper class to work with the stockfish engine.
 * Should work easily.
 * We use it in 2 places right now, repertoire & analysis.
 * 
 * 1) For repertoire, we want to feed a line and keep receiving best moves for X amount of time.
 * 2) For analysis, we want the bestmoves once after an X amount of time.
 * 
 * 
 * getBestMoves({ line, duration, oneTime, onReceive )
 * 
 * line: array of moves or string of moves
 * duration: max time to think in ms
 * oneTime: boolean, return best moves 1 time or keep thinking and sending moves
 * onReceive: callback for engine best moves (called once or continuously for duration)
 * 
 * 
 * - startEngine   : starts the engine
 * - stopEngine    : stops the engine
 * - startSearch   : starts a search for a certain array of moves (position) for a certain amount of time
 * - stopSearch     : stop active search
 * 
 * - startGame     : starts a new game, returns a promise, resolved once engine is ready.
 * 
 */
export class EngineHelper {
    // Game, UCI interface, options
    game = null;
    uci = null;
    options = {};

    // The current search line
    line = [];
    // The bestmoves we receive
    bestMoves = [];

    // Only send through onEngineInfo when it's still the current search
    currentSearchId = 0;
    interrupted = false;

    /**
     * Option to pass default duration ? default options in general..
     */
    constructor({ moves, duration, autoNewGame, receiveOnce, onReceive } = {}) {
        // Create the chess game
        this.game = new MyChess();
        // Store the options
        this.setOptions({ duration, autoNewGame, receiveOnce, onReceive });
    }

    /**
     * Updates the options. Helper function.
     */
    setOptions(settings) {
        this.options = {
            duration: settings.duration ?? this.options?.duration ?? 30000, // 30 seconds default
            receiveOnce: settings.receiveOnce ?? this.options?.receiveOnce ?? false,
            autoNewGame: settings.autoNewGame ?? this.options?.autoNewGame ?? true,
            onReceive: settings.onReceive ?? this.options?.onReceive ?? (() => { })
        };

        console.log('EngineHelper - setOptions:', this.options, settings);
    }

    /**
     * Starts the engine so it's ready to receive commands.
     */
    startEngine() {
        console.info("EngineHelper: Starting the engine.", this.uci);

        if (this.uci == null) {
            // Get the UCI interface
            this.uci = new UCI();

            // When we receive uciok, the engine is started and ready to receive commands
            this.uci.onReceive("uciok", this.onEngineOK.bind(this));

            // Start the engine
            this.uci.startEngine();
            // Send the uci command so the engine can get ready
            this.uci.sendUCI();

            // Bind listeners for receiving the info (bind once, these will keep receiving)
            //this.uci.onReceive("info", this.onEngineInfo.bind(this), false);
            this.uci.onReceive("bestmove", this.onEngineBestMove.bind(this), false);

        } else {

            console.log("EngineHelper: Already active, calling onEngineReady..");

            // restart a new evaluation
            this.onEngineOK();
        }
    }

    /**
     * Stops the engine.
     */
    stopEngine() {
        console.info("EngineHelper: Stopping the engine.", this.uci);

        if (this.uci !== null) {
            this.uci.stopEngine();
            this.uci = null;
        }
    }

    /**
     * Manually starts a new game. Returns a promise, resolved when engine is ready.
     * 
     * @returns {Promise}
     */
    startGame() {
        // Start newgame
        //this.uci.newGame();
        // When we receive readyok the engine is ready to be used
        //this.uci.onReceive("readyok", this.onEngineReady.bind(this));
        // Wait for isRready
        //this.uci.isReady();

        this.uci.newGame();
        
        return new Promise((resolve) => {
            this.uci.onReceive("readyok", resolve);
            this.uci.isReady();
        });
    }


    /**
     * Starts a search and feeds the best moves to the callback function.
     * Starts the engine if it isn't running.
     * Stops current search if any is active.
     * 
     * Option to pass SAN moves? We use this.game to translate to uci moves..
     * 
     * Need to remember the current search and not pass any more info if a new search started
     * and the info is from the old search.. how do we know that??
     * We receive another readyok ? After interrupting..
     * 
     * @param {array|string} moves - a string or array of uci moves needed to get to the position
     * @param {int} duration - the maximum time for the engine to evaluate
     * @param {bool} receiveOnce - receive the best moves only once or continuously for the duration
     * @param {function} onReceive - the callback function to receive the best moves
     */
    startSearch({ moves, duration, receiveOnce, onReceive } = {}) {
        console.log('EngineHelper: startSearch', moves, duration, receiveOnce, onReceive);

        // Store the options
        this.setOptions({ duration, receiveOnce, onReceive });
        // Store the moves
        this.moves = Array.isArray(moves) ? moves : (moves ? moves.trim().split(' ') : []);

        console.log('Moves array:', moves);

        // Interrupt the current search, if any
        this.interrupted = true;
        // We either start the engine or we interrupt it and wait for it to be ready
        this.startEngine();
    }

    /**
     * Stops the current search.
     * 
     * Feeds the best moves if not yet done ??
     */
    stopSearch() {
        // Interrupt the current evaluation
        this.engineInterrupt();
    }


    /* Internal functions */


    // Sends a command to the UCI engine to stop the current evaluation
    engineInterrupt() {
        console.info("EngineHelper: Interrupting the engine..");

        // Stop the current evaluation
        if (this.uci) this.uci.interrupt();
    }

    // Called when engine sends OK (after every command we send)
    onEngineOK() {
        console.info("EngineHelper: onEngineOK");

        if (!this.uci) return;

        // Get the search identifier
        this.currentSearchId = Date.now();;
        const searchId = this.currentSearchId;

        // Set or replace the receiver and add the search identifier
        this.uci.onReceive("info", (info) => {
            this.onEngineInfo(info, searchId);
        }, false, true);

        // Tell the engine we want the top 3 moves
        this.uci.setMultiPV(3);

        // When we receive readyok the engine is ready to be used
        this.uci.onReceive("readyok", this.onEngineReady.bind(this));

        // Interrupt the engine, just in case
        this.uci.interrupt();
        
        //
        // Maybe not always do a new game ??
        // We should check the moves / line, if its a new line, we can start a new game automatically..
        // If it matches earlier moves, dont..
        // What about variations ??
        // Add to constructor: option for starting new games on each search or let user do it manually
        //

        // If we have no current line or the line has changed, start a new game
        if (this.options.autoNewGame && (!this.line || !this.isSameGame(this.moves, this.line))) {
            
            console.log('EngineHelper: Starting a new game, not the same line.', this.options, this.moves, this.line);

            // Start newgame
            this.uci.newGame();
        }

        // Start newgame
        //this.uci.newGame();

        // Wait for isRready
        this.uci.isReady();
    }

    isSameGame(moves, line) {
        if (line.length > moves.length) return false;
        return line.every((val, i) => val === moves[i]);
    }

    /**
     * Called once the engine is ready to receive moves.
     * Resets the bestMoves array. Updates current search. Starts evaluation.
     * 
     * @returns 
     */
    onEngineReady() {
        console.info("EngineHelper: onEngineReady");

        // If no moves
        if (!this.moves) {
            console.warn('EngineHelper: No moves to evaluate.');
            return;
        }

        // Get the moves string
        const moves = this.moves.join(' ');

        console.log('EngineHelper: Starting search: ', this.moves);

        // Store the current search line
        this.line = this.moves;

        // The FEN string, do we need this?
        const fen = '';

        // Reset the bestMoves array
        this.bestMoves = [];
        // No longer interrupted
        this.interrupted = false;
        // Start the evaluation
        this.uci.evaluate(fen, moves, this.options.duration);

        /*
        //
        const fen = "";
        let moves = "";
        //
        const history = this.game.historyWithCorrectFen();
        for (let i = 0; i < history.length; i++) {
            //
            moves =
                moves + (moves !== "" ? " " : "") + history[i].from + history[i].to;
        }

        console.info("moves", moves);

        // remember the FEN we are calculating for
        this.engineFen = this.currentFen;

        console.info("starting evaluation using settings:");
        console.info(this.settings);

        // start the evaluation
        this.uci.evaluate(fen, moves, this.settings.repertoire_engine_time * 1000);
        */
    }

    /**
     * Receives info from the engine. Stores the multipv lines and sends through the info.
     * 
     * @param {array} info 
     */
    onEngineInfo(info, searchId) {
        // if for an old position
        //if (this.currentFen !== this.engineFen) {
        //  return false;
        //}


        /*
        // invert the centipawn and mate values
        const cp = info.score.cp !== null && invert ? info.score.cp * -1 : info.score.cp;
        const mate =
            info.score.mate !== null && invert
                ? info.score.mate * -1
                : info.score.mate;
        */

        //
        // If we only want to receive once, dont get the SAN moves (can happen a lot and takes time)
        // Remember the bestmoves
        // Send them when we receive 'bestmove'
        //

        console.log('EngineHelper: ', this.interrupted, this.options.receiveOnce, this.currentSearchId, searchId);

        // Only if the current search is not interrupted
        if (this.interrupted || searchId !== this.currentSearchId) return;

        // Get the multipv (rank 1-3 best move)
        const multipv = (parseInt(info["multipv"]) ?? 1) - 1;

        // Store the bestmoves
        this.bestMoves[multipv] = info;

        // If receive continuously, send through info
        if (!this.options.receiveOnce) {
            try {
                this.options.onReceive(info);
            } catch (e) {
                // Not our error
            }
        }
    }

    /**
     * 
     * @param {*} bestMove 
     */
    onEngineBestMove(bestMove) {
        console.info("EngineHelper: onEngineBestMove", bestMove, this.options.receiveOnce);

        // If receiving only once, send it through now
        if (this.options.receiveOnce) {
            try {
                this.options.onReceive(this.bestMoves);
            } catch (e) {
                // Not our error
            }
        }
    }

    /**
     * Gets the SAN moves for a uci line.
     */
    getSanMoves(line) {
        try {
            // Create a game
            const game = new MyChess();
            // Load the FEN if needed
            //game.load(this.currentFen);

            // Make the moves
            for (let i = 0; i < line.length; i++) {
                game.move({
                    from: line.substring(0, 2), to: line.substring(2, 4),
                    promotion: line.length == 5 ? line.substring(4, 5) : "",
                });
            }

            // Return the history
            return game.history({ verbose: true });
        } catch (err) {
            console.error("EngineHelper: Error:", err, line);
        }

        return [];
    }
}