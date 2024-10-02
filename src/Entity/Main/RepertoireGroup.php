<?php

namespace App\Entity\Main;

use App\Repository\RepertoireGroupRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: RepertoireGroupRepository::class)]
class RepertoireGroup
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'repertoireGroups')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Repertoire $Repertoire = null;

    #[ORM\ManyToOne(inversedBy: 'repertoireGroups')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Group $Grp = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getRepertoire(): ?Repertoire
    {
        return $this->Repertoire;
    }

    public function setRepertoire(?Repertoire $Repertoire): static
    {
        $this->Repertoire = $Repertoire;

        return $this;
    }

    public function getGrp(): ?Group
    {
        return $this->Grp;
    }

    public function setGrp(?Group $Grp): static
    {
        $this->Grp = $Grp;

        return $this;
    }
}
