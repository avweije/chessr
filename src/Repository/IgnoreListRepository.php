<?php

namespace App\Repository;

use App\Entity\IgnoreList;
use App\Service\ChessHelper;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * @extends ServiceEntityRepository<IgnoreList>
 */
class IgnoreListRepository extends ServiceEntityRepository
{
    private $chessHelper;

    public function __construct(ManagerRegistry $registry, ChessHelper $chessHelper)
    {
        parent::__construct($registry, IgnoreList::class);

        // configure the result cache
        $cache = new \Symfony\Component\Cache\Adapter\ArrayAdapter();
        $config = new \Doctrine\ORM\Configuration();
        //$config = $conn->getConfiguration();
        $config->setResultCache($cache);

        $this->chessHelper = $chessHelper;
    }

    /**
     * isOnIgnoreList - Check if a move is on the ignore list.
     *
     * @param  mixed $fen
     * @param  mixed $move
     * @return bool
     */
    public function isOnIgnoreList(UserInterface $user, string $fen, string $move): bool
    {
        // Normalize the FEN string for evaluations
        $fen = $this->chessHelper->normalizeFenForEvaluation($fen);
        // get the query
        $query = $this->createQueryBuilder('i')
            ->andWhere('i.User = :user AND i.Fen = :fen AND i.Move = :move')
            ->setParameter('user', $user)
            ->setParameter('fen', $fen)
            ->setParameter('move', $move)
            ->getQuery();
        // cache the results for speed
        $query->enableResultCache();

        return count($query->getResult()) > 0;
    }
}
