<?php

namespace App\Repository;

use App\Entity\Main\IgnoreList;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * @extends ServiceEntityRepository<IgnoreList>
 */
class IgnoreListRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, IgnoreList::class);

        // configure the result cache
        $cache = new \Symfony\Component\Cache\Adapter\ArrayAdapter();
        $config = new \Doctrine\ORM\Configuration();
        //$config = $conn->getConfiguration();
        $config->setResultCache($cache);
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

    //    /**
    //     * @return IgnoreList[] Returns an array of IgnoreList objects
    //     */
    //    public function findByExampleField($value): array
    //    {
    //        return $this->createQueryBuilder('i')
    //            ->andWhere('i.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->orderBy('i.id', 'ASC')
    //            ->setMaxResults(10)
    //            ->getQuery()
    //            ->getResult()
    //        ;
    //    }

    //    public function findOneBySomeField($value): ?IgnoreList
    //    {
    //        return $this->createQueryBuilder('i')
    //            ->andWhere('i.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
