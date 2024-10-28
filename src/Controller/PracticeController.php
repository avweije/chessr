<?php

namespace App\Controller;

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

    #[Route('/practice', methods: ['GET', 'POST'], name: 'app_practice')]
    public function index(Request $request): Response
    {
        // get the payload (if posted)
        $data = $request->getPayload()->all();

        // get the practice repertoire type
        $type = isset($data["type"]) ? $data["type"] : "all";
        // get the repertoire id (from the roadmap)
        $id = isset($data["id"]) ? $data["id"] : "";

        // the data to send to the page
        $data = [
            'repertoireType' => $id != "" ? "custom" : $type,
            'repertoireId' => $id
        ];

        return $this->render('practice/index.html.twig', $data);
    }
}
