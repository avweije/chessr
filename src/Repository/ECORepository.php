<?php

namespace App\Repository;

use App\Entity\ECO;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ECO>
 */
class ECORepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ECO::class);
    }

    public function findBybyPgn($pgn): array
    {
        // we use the number of spaces in the pgn to find the next moves
        $spaces = substr_count($pgn, ' ');
        // if it's white to move, we need to add an extra space
        if (($spaces + 1) % 3 == 0) {
            $spaces++;
        }

        // build the query
        $qb = $this->createQueryBuilder('ECO')
            ->andWhere('ECO.PGN LIKE \'' . $pgn . '%\'')
            ->andWhere('LENGTH(ECO.PGN) - LENGTH(REPLACE(ECO.PGN, \' \', \'\')) <= :spaces')
            ->setParameter('spaces', $spaces + 1)
            //->orderBy('LENGTH(ECO.PGN)', 'ASC')
            ->getQuery();

        $resp = array('current' => '', 'spaces' => $spaces, 'next' => []);

        foreach ($qb->getArrayResult() as $r) {
            if ($pgn == $r['PGN']) {
                $resp['current'] = $r;
            } else {
                $resp['next'][] = $r;
            }
        }

        return $resp;
    }
    //    /**
    //     * @return ECO[] Returns an array of ECO objects
    //     */
    //    public function findByExampleField($value): array
    //    {
    //        return $this->createQueryBuilder('e')
    //            ->andWhere('e.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->orderBy('e.id', 'ASC')
    //            ->setMaxResults(10)
    //            ->getQuery()
    //            ->getResult()
    //        ;
    //    }

    //    public function findOneBySomeField($value): ?ECO
    //    {
    //        return $this->createQueryBuilder('e')
    //            ->andWhere('e.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
