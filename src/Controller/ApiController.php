<?php

namespace App\Controller;

use App\Entity\Repertoire;
use App\Entity\Settings;
use App\Entity\User;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpFoundation\Request;

class ApiController extends AbstractController
{
    public function __construct(private Connection $conn, private EntityManagerInterface $em) {}

    #[Route('/api/settings', methods: ['GET'], name: 'api_get_settings')]
    /**
     * Get the user settings.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiGetSettings(Request $request): JsonResponse
    {
        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        //dd($settings, $user);

        if ($settings == null) {
            // create the settings
            $settings = new Settings();
            $settings->setUser($this->getUser());
            $settings->setAnimationDuration(300);
            $settings->setRepertoireEngineTime(30);
            $settings->setAnalyseEngineTime(1000);
            $settings->setAnalyseIgnoreInaccuracy(false);
            $settings->setMistakeTolerance(0);
            $settings->setRecommendInterval(0);
            $settings->setBalloonsAmount(1);
            $settings->setAnimateVariation(0);

            // save the settings
            $this->em->persist($settings);
            $this->em->flush();
        }

        return new JsonResponse(["settings" => [
            "email" => $user->getEmail(),
            "board" => $settings->getBoard(),
            "pieces" => $settings->getPieces(),
            "animation_duration" => $settings->getAnimationDuration(),
            "repertoire_engine_time" => $settings->getRepertoireEngineTime(),
            "analyse_engine_time" => $settings->getAnalyseEngineTime(),
            "analyse_ignore_inaccuracy" => $settings->isAnalyseIgnoreInaccuracy(),
            "analyse_mistake_tolerance" => $settings->getMistakeTolerance(),
            "recommend_interval" => $settings->getRecommendInterval(),
            "balloons_amount" => $settings->getBalloonsAmount(),
            "animate_variation" => $settings->getAnimateVariation(),
        ]]);
    }

    #[Route('/api/settings', methods: ['POST'], name: 'api_save_settings')]
    /**
     * Save (update) the user settings.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiSaveSettings(Request $request): JsonResponse
    {
        // get the payload
        $payload = $request->getPayload()->all();

        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        if ($settings == null) {
            // create the settings
            $settings = new Settings();
            $settings->setUser($this->getUser());
            $settings->setAnimationDuration(300);
            $settings->setRepertoireEngineTime(30);
            $settings->setAnalyseEngineTime(1000);
            $settings->setAnalyseIgnoreInaccuracy(false);
            $settings->setMistakeTolerance(0);
            $settings->setRecommendInterval(0);
            $settings->setBalloonsAmount(1);
            $settings->setAnimateVariation(0);
        }

        // update all the settings
        foreach ($payload["settings"] as $key => $value) {
            switch ($key) {
                case "board":
                    $settings->setBoard($value);
                    break;
                case "pieces":
                    $settings->setPieces($value);
                    break;
                case "animation_duration":
                    $settings->setAnimationDuration($value);
                    break;
                case "repertoire_engine_time":
                    $settings->setRepertoireEngineTime($value);
                    break;
                case "analyse_engine_time":
                    $settings->setAnalyseEngineTime($value);
                    break;
                case "analyse_ignore_inaccuracy":
                    $settings->setAnalyseIgnoreInaccuracy($value);
                    break;
                case "analyse_mistake_tolerance":
                    $settings->setMistakeTolerance($value);
                    break;
                case "recommend_interval":
                    // If the interval has changed, reset the session recommended lines
                    if ($settings->getRecommendInterval() !== $value) {
                        // Unset the session recommended lines so they will be recalculated
                        $_SESSION['recommendedLines'] = null;
                        unset($_SESSION['recommendedLines']);
                    }
                    $settings->setRecommendInterval($value);
                    break;
                case "balloons_amount":
                    $settings->setBalloonsAmount($value);
                    break;
                case "animate_variation":
                    $settings->setAnimateVariation($value);
                    break;
            }
        }

        // save the settings
        $this->em->persist($settings);
        $this->em->flush();

        return new JsonResponse(["message" => "Settings updated."]);
    }

    #[Route('/api/download/settings', methods: ['GET'], name: 'api_download_settings')]
    /**
     * Gets the download settings (used for analyse and/or opponent pages).
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiDownloaddSettings(Request $request): JsonResponse
    {
        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        if ($settings == null) {
            // create the settings
            $settings = new Settings();
            $settings->setUser($this->getUser());
            $settings->setAnimationDuration(300);
            $settings->setRepertoireEngineTime(30);
            $settings->setAnalyseEngineTime(1000);
            $settings->setAnalyseIgnoreInaccuracy(false);
            $settings->setRecommendInterval(0);
            $settings->setBalloonsAmount(1);
            $settings->setAnimateVariation(0);

            // save the settings
            $this->em->persist($settings);
            $this->em->flush();
        }

        return new JsonResponse(["settings" => [
            "site" => $settings->getSite(),
            "chess_username" => $settings->getChessUsername(),
            "lichess_username" => $settings->getLichessUsername(),
            "analyse_engine_time" => $settings->getAnalyseEngineTime(),
            "analyse_ignore_inaccuracy" => $settings->isAnalyseIgnoreInaccuracy()
        ]]);
    }

    #[Route('/api/find/similar', name: 'api_find_similar_positions')]
    /**
     * TEST - Trying to find similar positions, based on FEN. Was close, but not giving me the positions I wanted.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiFindSimilarFen(Request $request): JsonResponse
    {
        $color = "white";
        //$fen = "rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 5";
        $fen = "rnbq1rk1/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQ - 1 5";

        // 1st close to 2nd, but 3rd is found (also close, but would prefer 2nd to be found..)
        // rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 5
        // rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4
        // r1bqk2r/ppp2ppp/2n1pn2/3p4/QbPP4/2N2N2/PP2PPPP/R1B1KB1R w KQkq - 4 6

        $closest = -1;
        $matches = [];

        // get the fen without the move numbers
        $parts = explode(" ", $fen);
        $fenColor = $parts[1];
        $fenWithout = implode(" ", array_slice($parts, 0, 3));
        $fenWithout = $this->replaceFenEmptySquares($fenWithout);

        //dd($fenColor, $fenWithout);

        $repo = $this->em->getRepository(Repertoire::class);

        $res = $repo->findBy(['Color' => $color]);
        foreach ($res as $rec) {
            // skip if exactly the same
            if ($fen === $rec->getFenAfter()) {
                continue;
            }

            $parts = explode(" ", $rec->getFenAfter());
            $fenColor2 = $parts[1];
            $fenWithout2 = implode(" ", array_slice($parts, 0, 3));
            $fenWithout2 = $this->replaceFenEmptySquares($fenWithout2);

            if ($fenColor !== $fenColor2) {
                continue;
            }

            /*
            $lev = levenshtein($fenWithout, $fenWithout2);
            if ($lev < $closest || $closest < 0) {
                $closest = $lev;
                $matches = ["lev" => $lev, "rec" => $rec];
            } else if ($lev === $closest) {
                $matches[] = ["lev" => $lev, "rec" => $rec];
            }*/

            $sim = similar_text($fenWithout, $fenWithout2, $pct);
            if ($pct > $closest) {
                $closest = $pct;
                $matches = ["chars" => $sim, "percentage" => $pct, "rec" => $rec];
            } else if ($pct == $closest) {
                $matches[] = ["chars" => $sim, "percentage" => $pct, "rec" => $rec];
            }
        }

        dd($matches);
    }

    /**
     * Helper function, replace numbers in FEN (representing empty squares) by x's, to make the string comparison better.
     *
     * @param  mixed $fen
     * @return string
     */
    private function replaceFenEmptySquares($fen): string
    {
        for ($i = 1; $i < 9; $i++) {
            $fen = str_replace($i, str_pad("x", $i), $fen);
        }
        return $fen;
    }
}
