<?php

namespace App\Controller;

use App\Entity\Moves;
use App\Entity\Repertoire;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class PracticeController extends AbstractController
{
    private $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    #[Route([
        '/practice',
        '/practice/white',
        '/practice/black',
        '/practice/new',
        '/practice/recommended',
        '/practice/analysis'
    ], name: 'app_practice')]
    public function index(Request $request): Response
    {
        // get the practice repertoire type
        $type = str_replace("/", "", str_replace("/practice", "", $request->getRequestUri()));
        if ($type == "") {
            $type = "all";
        }

        return $this->render('practice/index.html.twig', ['repertoireType' => $type]);
    }
}
