<?php

namespace App\Controller;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class RepertoireController extends AbstractController
{
    private $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    #[Route(['/repertoire', '/repertoire/{color}'], methods: ['GET', 'POST'], name: 'app_repertoire')]
    public function index(Request $request, ?string $color): Response
    {
        // get the payload (if posted)
        $data = $request->getPayload()->all();

        //dd($data);

        // get the color (not used?)
        $color = $color && $color == "black" ? $color : "white";

        return $this->render('repertoire/index.html.twig', [
            'repertoireColor' => $color,
            'repertoireFen' => $data && isset($data["fen"]) ? $data["fen"] : "",
            'repertoireLine' => $data && isset($data["line"]) ? join(",", $data["line"]) : ""
        ]);
    }
}
