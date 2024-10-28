<?php

namespace App\Service;

use App\Entity\Main\Analysis;
use App\Entity\Main\Repertoire;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\Security\Core\User\UserInterface;

class TemplateService
{
    public function __construct(private EntityManagerInterface $em, private Security $security) {}

    public function hasRepertoire(): bool
    {
        // if the user is logged in & has a repertoire
        return $this->security->getUser() && $this->security->getUser()->getRepertoires()->isEmpty() == false;
    }

    public function hasAnalysis(): bool
    {
        // if the user is logged in & has analysis records
        if ($this->security->getUser()) {
            // get the analysis repository
            $repo = $this->em->getRepository(Analysis::class);
            // get the mistakes for this user
            return count($repo->findBy(['User' => $this->security->getUser()])) > 0;
        }

        return false;
    }
}
