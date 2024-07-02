<?php

namespace App\Controller;

use App\Entity\Repertoire;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class PracticeController extends AbstractController
{
    private $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    #[Route('/practice', name: 'app_practice')]
    public function index(): Response
    {

        // get the repository
        //$repository = $this->em->getRepository(Repertoire::class);

        //$res = $repository->findBy(['Color' => 'white'], ['HalfMove' => 'ASC']);

        return $this->render('practice/index.html.twig');
    }
}
