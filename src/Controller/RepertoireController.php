<?php

namespace App\Controller;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class RepertoireController extends AbstractController
{
    private $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    #[Route(['/repertoire', '/repertoire/{color}'], name: 'app_repertoire')]
    public function index(?string $color): Response
    {
        // $type = white/black/all
        $color = $color && $color == "black" ? $color : "white";

        return $this->render('repertoire/index.html.twig', [
            'repertoireColor' => $color,
        ]);
    }
}
