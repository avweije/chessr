<?php
// src/Controller/ChessrAbstractController.php
namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;

class ChessrAbstractController extends AbstractController
{
    private EntityManagerInterface $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
        // update last login
        $this->updateLastLogin();
    }

    public function updateLastLogin()
    {
        // Get the currently logged-in user
        $user = $this->getUser();
        if (!$user instanceof User) {
            return;
        }

        // Get today's date
        $today = new \DateTimeImmutable('today');

        // get the days since last login
        $daysSinceLastLogin = $user->getLastLogin() ? $today->diff($user->getLastLogin())->days : -1;
        // add to the deltas
        if ($daysSinceLastLogin > 0) {
            $user->addDelta($daysSinceLastLogin);
        }

        if (!$user->getLastLogin() || $user->getLastLogin() < $today) {
            $user->setLastLogin($today);
            $this->em->flush();
        }
    }
}
