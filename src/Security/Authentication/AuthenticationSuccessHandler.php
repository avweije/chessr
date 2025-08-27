<?php
// src/Security/Authentication/AuthenticationSuccessHandler.php
namespace App\Security\Authentication;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Http\HttpUtils;
use Symfony\Component\Security\Http\Authentication\DefaultAuthenticationSuccessHandler;

class AuthenticationSuccessHandler extends DefaultAuthenticationSuccessHandler
{
    public function __construct(
        private EntityManagerInterface $em,
        HttpUtils $httpUtils, array $options = [], ?LoggerInterface $logger = null
    ) {
        parent::__construct($httpUtils, $options, $logger);
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token): ?Response
    {
        $user = $token->getUser();

        //dd($user);

        if ($user instanceof User) {

            $today = new \DateTimeImmutable('today');

            // get the days since last login
            $daysSinceLastLogin = $user->getLastLogin() ? $today->diff($user->getLastLogin())->days : -1;

            if (!$user->getLastLogin() || $user->getLastLogin() < $today) {
                // add to the deltas
                if ($daysSinceLastLogin > 0) {
                    $user->addDelta($daysSinceLastLogin);
                }
                // update last login date
                $user->setLastLogin($today);
                $this->em->flush();
            }
        }

        return parent::onAuthenticationSuccess($request, $token);
    }
}
