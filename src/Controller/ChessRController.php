<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpFoundation\Response;

class ChessRController extends AbstractController
{
    #[Route('/', name: 'app_main')]
    public function index(): Response
    {

        $user = $this->getUser();

        if ($user) {
            return $this->render('chessr/index.html.twig');
        } else {
            return $this->redirectToRoute('app_login');
        }
    }
}
