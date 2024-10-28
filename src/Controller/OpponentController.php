<?php

namespace App\Controller;

use App\Entity\Main\Opponent;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class OpponentController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em) {}

    #[Route('/opponent', name: 'app_opponent')]
    public function index(): Response
    {
        // get the opponents
        $opponents = [];

        $repo = $this->em->getRepository(Opponent::class);
        foreach ($repo->findAll() as $opp) {
            $opponents[] = [
                "id" => $opp->getId(),
                "username" => $opp->getUsername(),
                "site" => $opp->getSite()->value,
                "total" => $opp->getTotal()
            ];
        }

        return $this->render('opponent/index.html.twig', [
            'opponents' => $opponents,
        ]);
    }
}
