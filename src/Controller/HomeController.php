<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpFoundation\Response;

class HomeController extends AbstractController
{
    #[Route(['/', '/home'], name: 'app_main')]
    public function index(): Response
    {

        $user = $this->getUser();

        if ($user) {
            return $this->render('home/index.html.twig');
        } else {
            return $this->redirectToRoute('app_login');
        }
    }
}
