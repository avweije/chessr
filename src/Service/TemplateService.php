<?php

namespace App\Service;

use App\Entity\Analysis;
use App\Entity\Repertoire;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\Security\Core\User\UserInterface;

class TemplateService
{
    public function __construct(private EntityManagerInterface $em, private Security $security) {}

    public function hasRepertoire(): bool
    {
        // if the user is logged in & has a repertoire
        $user = $this->security->getUser();
        // Check if $user is your User entity
        if ($user instanceof User) {
            return !$user->getRepertoires()->isEmpty();
        }
        return false;
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
