<?php

namespace App\Controller;

use App\Controller\ChessrAbstractController;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\DBAL\Connection;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class RoadmapController extends ChessrAbstractController
{
    public function __construct(private Connection $conn, private EntityManagerInterface $em, private ManagerRegistry $doctrine, private PracticeController $practice) {}

    #[Route('/roadmap', name: 'app_roadmap')]
    public function index(): Response
    {
        return $this->render('roadmap/index.html.twig');
    }

    #[Route('/api/roadmap', methods: ['GET'], name: 'app_api_roadmap')]
    /**
     * Gets the roadmap. All lines and variations for white and black, with ECO codes, number of moves,
     * number of variations and accuracy per variation.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiRoadmap(Request $request): JsonResponse
    {
        return $this->practice->apiPractice($request, true);
    }
}
