<?php

namespace App\Controller;

use App\Controller\ChessrAbstractController;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class SettingsController extends ChessrAbstractController
{
    public function __construct() {}

    #[Route('/settings', name: 'settings')]
    public function index(): Response
    {
        return $this->render('settings/index.html.twig');
    }
}
