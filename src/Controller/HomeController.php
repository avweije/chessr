<?php

namespace App\Controller;

use App\Controller\ChessrAbstractController;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\DBAL\Connection;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpFoundation\Response;

class HomeController extends ChessrAbstractController
{
    public function __construct(private Connection $conn, private EntityManagerInterface $em, private ManagerRegistry $doctrine, private PracticeController $practice) {}

    #[Route(['/', '/home'], name: 'home')]
    public function index(): Response
    {

        $user = $this->getUser();

        if ($user) {
            return $this->render('home/index.html.twig');
        } else {
            return $this->redirectToRoute('app_login');
        }
    }

    #[Route('/api/statistics', methods: ['GET'], name: 'app_api_statistics')]
    /**
     * Gets the statistics for the homepage. Number of repertoire, practice and analysis moves.
     *
     * @param  mixed $request
     * @param  mixed $isRoadmap
     * @return JsonResponse
     */
    public function apiStatistics(Request $request, bool $isRoadmap = false): JsonResponse
    {
        return $this->practice->apiPractice($request, false, true);
    }
}
